-- ============================================
-- FILE: database/migrations/024_integration_tables.sql
-- DESCRIPTION: Complete integration services tables for SMS, Email, Payment, Cloud, Insurance
--              + Clinical & Operational Tables (diagnosis, visits, clinical_notes, 
--                medications, handover_notes, transport_requests)
-- SAFE MIGRATION: Can be run multiple times without errors (CREATE TABLE IF NOT EXISTS)
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
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT check_reminder_type CHECK (reminder_type IN ('24h', '2h', '1h')),
    CONSTRAINT check_sms_status CHECK (status IN ('pending', 'sent', 'failed'))
);

COMMENT ON TABLE sms_reminders IS 'SMS reminders for patient appointments';
COMMENT ON COLUMN sms_reminders.id IS 'Primary key - UUID';
COMMENT ON COLUMN sms_reminders.appointment_id IS 'Foreign key to appointments table';
COMMENT ON COLUMN sms_reminders.patient_phone IS 'Patient phone number for SMS';
COMMENT ON COLUMN sms_reminders.patient_name IS 'Patient name for personalization';
COMMENT ON COLUMN sms_reminders.doctor_name IS 'Doctor name for appointment details';
COMMENT ON COLUMN sms_reminders.appointment_date IS 'Date of appointment';
COMMENT ON COLUMN sms_reminders.appointment_time IS 'Time of appointment';
COMMENT ON COLUMN sms_reminders.reminder_type IS '24h before, 2h before, 1h before';
COMMENT ON COLUMN sms_reminders.scheduled_time IS 'When SMS was scheduled to send';
COMMENT ON COLUMN sms_reminders.sent_time IS 'When SMS was actually sent';
COMMENT ON COLUMN sms_reminders.status IS 'pending, sent, failed';
COMMENT ON COLUMN sms_reminders.error_message IS 'Error message if sending failed';
COMMENT ON COLUMN sms_reminders.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN sms_reminders.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_sms_reminders_status ON sms_reminders(status);
CREATE INDEX IF NOT EXISTS idx_sms_reminders_scheduled ON sms_reminders(scheduled_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sms_reminders_appointment ON sms_reminders(appointment_id);

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
        REFERENCES critical_alerts(id) ON DELETE SET NULL,
    
    CONSTRAINT check_alert_type CHECK (alert_type IN ('lab_critical', 'panic', 'emergency')),
    CONSTRAINT check_priority CHECK (priority BETWEEN 1 AND 5),
    CONSTRAINT check_escalation CHECK (escalation_level >= 0),
    CONSTRAINT check_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'expired'))
);

COMMENT ON TABLE critical_alerts IS 'Critical alerts for lab values, panic values, and emergencies';
COMMENT ON COLUMN critical_alerts.id IS 'Primary key - UUID';
COMMENT ON COLUMN critical_alerts.alert_type IS 'lab_critical, panic, emergency';
COMMENT ON COLUMN critical_alerts.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN critical_alerts.patient_phone IS 'Patient phone for emergency contact';
COMMENT ON COLUMN critical_alerts.patient_name IS 'Patient name';
COMMENT ON COLUMN critical_alerts.doctor_id IS 'Foreign key to employees table (doctor)';
COMMENT ON COLUMN critical_alerts.doctor_phone IS 'Doctor phone for alert';
COMMENT ON COLUMN critical_alerts.alert_message IS 'Alert message content';
COMMENT ON COLUMN critical_alerts.priority IS '1-5 (5 highest)';
COMMENT ON COLUMN critical_alerts.triggered_by IS 'User who triggered the alert';
COMMENT ON COLUMN critical_alerts.triggered_at IS 'When alert was triggered';
COMMENT ON COLUMN critical_alerts.sent_at IS 'When alert was sent';
COMMENT ON COLUMN critical_alerts.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN critical_alerts.acknowledged_at IS 'When alert was acknowledged';
COMMENT ON COLUMN critical_alerts.escalation_level IS '0 = none, 1 = supervisor, 2 = department head, 3 = admin';
COMMENT ON COLUMN critical_alerts.parent_alert_id IS 'Parent alert ID for escalation chain';
COMMENT ON COLUMN critical_alerts.status IS 'active, acknowledged, resolved, expired';
COMMENT ON COLUMN critical_alerts.metadata IS 'Additional metadata in JSON format';

CREATE INDEX IF NOT EXISTS idx_critical_alerts_priority ON critical_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_status ON critical_alerts(status);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_triggered ON critical_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_acknowledged ON critical_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_critical_alerts_ack_by ON critical_alerts(acknowledged_by) WHERE acknowledged_by IS NOT NULL;

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_otp_purpose CHECK (purpose IN ('login', 'verification', 'password_reset')),
    CONSTRAINT check_otp_attempts CHECK (attempt_count >= 0),
    CONSTRAINT check_otp_code_length CHECK (LENGTH(otp_code) = 6),
    CONSTRAINT check_otp_status CHECK (status IN ('pending', 'verified', 'expired', 'failed'))
);

COMMENT ON TABLE otp_logs IS 'OTP logs for authentication and verification';
COMMENT ON COLUMN otp_logs.id IS 'Primary key - UUID';
COMMENT ON COLUMN otp_logs.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN otp_logs.phone_number IS 'Phone number where OTP was sent';
COMMENT ON COLUMN otp_logs.otp_code IS '6-digit OTP code';
COMMENT ON COLUMN otp_logs.purpose IS 'login, verification, password_reset';
COMMENT ON COLUMN otp_logs.expires_at IS 'OTP expiry timestamp';
COMMENT ON COLUMN otp_logs.verified_at IS 'When OTP was verified';
COMMENT ON COLUMN otp_logs.sent_at IS 'When OTP was sent';
COMMENT ON COLUMN otp_logs.ip_address IS 'IP address of request';
COMMENT ON COLUMN otp_logs.device_info IS 'Device information in JSON';
COMMENT ON COLUMN otp_logs.attempt_count IS 'Number of verification attempts';
COMMENT ON COLUMN otp_logs.status IS 'pending, verified, expired, failed';
COMMENT ON COLUMN otp_logs.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_otp_logs_phone ON otp_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_logs_expires ON otp_logs(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_logs_status ON otp_logs(status);
CREATE INDEX IF NOT EXISTS idx_otp_logs_user ON otp_logs(user_id);

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
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT check_bill_notification_type CHECK (notification_type IN ('new', 'reminder', 'overdue')),
    CONSTRAINT check_bill_amount CHECK (bill_amount >= 0),
    CONSTRAINT check_bill_status CHECK (status IN ('pending', 'sent', 'failed'))
);

COMMENT ON TABLE bill_notifications IS 'Bill and payment notifications';
COMMENT ON COLUMN bill_notifications.id IS 'Primary key - UUID';
COMMENT ON COLUMN bill_notifications.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN bill_notifications.patient_phone IS 'Patient phone number';
COMMENT ON COLUMN bill_notifications.patient_name IS 'Patient name';
COMMENT ON COLUMN bill_notifications.bill_amount IS 'Bill amount';
COMMENT ON COLUMN bill_notifications.due_date IS 'Payment due date';
COMMENT ON COLUMN bill_notifications.notification_type IS 'new = new bill, reminder = payment reminder, overdue = overdue bill';
COMMENT ON COLUMN bill_notifications.scheduled_time IS 'When notification was scheduled';
COMMENT ON COLUMN bill_notifications.sent_time IS 'When notification was sent';
COMMENT ON COLUMN bill_notifications.status IS 'pending, sent, failed';
COMMENT ON COLUMN bill_notifications.error_message IS 'Error message if sending failed';
COMMENT ON COLUMN bill_notifications.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_bill_notifications_status ON bill_notifications(status);
CREATE INDEX IF NOT EXISTS idx_bill_notifications_scheduled ON bill_notifications(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_bill_notifications_invoice ON bill_notifications(invoice_id);

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
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT check_payment_method CHECK (payment_method IN ('cash', 'card', 'upi', 'netbanking', 'wallet')),
    CONSTRAINT check_payment_amount CHECK (amount >= 0),
    CONSTRAINT check_payment_status CHECK (status IN ('pending', 'sent', 'failed'))
);

COMMENT ON TABLE payment_confirmations IS 'Payment confirmation messages';
COMMENT ON COLUMN payment_confirmations.id IS 'Primary key - UUID';
COMMENT ON COLUMN payment_confirmations.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN payment_confirmations.transaction_id IS 'Payment transaction ID';
COMMENT ON COLUMN payment_confirmations.patient_phone IS 'Patient phone number';
COMMENT ON COLUMN payment_confirmations.patient_name IS 'Patient name';
COMMENT ON COLUMN payment_confirmations.amount IS 'Payment amount';
COMMENT ON COLUMN payment_confirmations.payment_method IS 'cash, card, upi, netbanking, wallet';
COMMENT ON COLUMN payment_confirmations.payment_date IS 'Date of payment';
COMMENT ON COLUMN payment_confirmations.sent_at IS 'When confirmation was sent';
COMMENT ON COLUMN payment_confirmations.status IS 'pending, sent, failed';
COMMENT ON COLUMN payment_confirmations.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_payment_confirmations_transaction ON payment_confirmations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_status ON payment_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_invoice ON payment_confirmations(invoice_id);

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
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT check_email_invoice_status CHECK (status IN ('pending', 'sent', 'failed', 'opened')),
    CONSTRAINT check_email_format CHECK (patient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE email_invoices IS 'Email records for invoices';
COMMENT ON COLUMN email_invoices.id IS 'Primary key - UUID';
COMMENT ON COLUMN email_invoices.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN email_invoices.patient_email IS 'Patient email address';
COMMENT ON COLUMN email_invoices.patient_name IS 'Patient name';
COMMENT ON COLUMN email_invoices.invoice_pdf_url IS 'URL to invoice PDF';
COMMENT ON COLUMN email_invoices.email_subject IS 'Email subject line';
COMMENT ON COLUMN email_invoices.email_body IS 'Email body content';
COMMENT ON COLUMN email_invoices.cc_recipients IS 'CC recipients email addresses';
COMMENT ON COLUMN email_invoices.bcc_recipients IS 'BCC recipients email addresses';
COMMENT ON COLUMN email_invoices.sent_at IS 'When email was sent';
COMMENT ON COLUMN email_invoices.opened_at IS 'When email was opened';
COMMENT ON COLUMN email_invoices.status IS 'pending, sent, failed, opened';
COMMENT ON COLUMN email_invoices.error_message IS 'Error message if sending failed';
COMMENT ON COLUMN email_invoices.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_email_invoices_status ON email_invoices(status);
CREATE INDEX IF NOT EXISTS idx_email_invoices_sent ON email_invoices(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_invoices_invoice ON email_invoices(invoice_id);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_email_report_type CHECK (report_type IN ('lab', 'radiology', 'prescription')),
    CONSTRAINT check_email_report_status CHECK (status IN ('pending', 'sent', 'failed', 'opened')),
    CONSTRAINT check_email_format_patient CHECK (patient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE email_reports IS 'Email records for reports';
COMMENT ON COLUMN email_reports.id IS 'Primary key - UUID';
COMMENT ON COLUMN email_reports.report_type IS 'lab, radiology, prescription';
COMMENT ON COLUMN email_reports.report_id IS 'Reference ID to specific report table';
COMMENT ON COLUMN email_reports.patient_email IS 'Patient email address';
COMMENT ON COLUMN email_reports.patient_name IS 'Patient name';
COMMENT ON COLUMN email_reports.doctor_email IS 'Doctor email for copy';
COMMENT ON COLUMN email_reports.report_pdf_url IS 'URL to report PDF';
COMMENT ON COLUMN email_reports.email_subject IS 'Email subject line';
COMMENT ON COLUMN email_reports.email_body IS 'Email body content';
COMMENT ON COLUMN email_reports.attachments IS 'Additional attachments in JSON';
COMMENT ON COLUMN email_reports.sent_at IS 'When email was sent';
COMMENT ON COLUMN email_reports.opened_at IS 'When email was opened';
COMMENT ON COLUMN email_reports.status IS 'pending, sent, failed, opened';
COMMENT ON COLUMN email_reports.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_email_reports_type ON email_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_email_reports_status ON email_reports(status);
CREATE INDEX IF NOT EXISTS idx_email_reports_sent ON email_reports(sent_at);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_system_alert_type CHECK (alert_type IN ('system', 'database', 'security', 'performance')),
    CONSTRAINT check_severity CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT check_system_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

COMMENT ON TABLE system_alerts IS 'System alerts sent to IT/admin staff';
COMMENT ON COLUMN system_alerts.id IS 'Primary key - UUID';
COMMENT ON COLUMN system_alerts.alert_type IS 'system, database, security, performance';
COMMENT ON COLUMN system_alerts.severity IS 'critical, high, medium, low';
COMMENT ON COLUMN system_alerts.title IS 'Alert title';
COMMENT ON COLUMN system_alerts.message IS 'Alert message';
COMMENT ON COLUMN system_alerts.recipients_to IS 'Primary recipients email addresses';
COMMENT ON COLUMN system_alerts.recipients_cc IS 'CC recipients email addresses';
COMMENT ON COLUMN system_alerts.sent_at IS 'When alert was sent';
COMMENT ON COLUMN system_alerts.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN system_alerts.acknowledged_at IS 'When alert was acknowledged';
COMMENT ON COLUMN system_alerts.resolved_at IS 'When alert was resolved';
COMMENT ON COLUMN system_alerts.status IS 'active, acknowledged, resolved';
COMMENT ON COLUMN system_alerts.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN system_alerts.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_weekly_summary_type CHECK (summary_type IN ('admin', 'doctor', 'billing', 'inventory')),
    CONSTRAINT check_weekly_status CHECK (status IN ('pending', 'sent', 'failed', 'opened')),
    CONSTRAINT check_email_format_weekly CHECK (recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE weekly_summaries IS 'Weekly summary reports sent to various roles';
COMMENT ON COLUMN weekly_summaries.id IS 'Primary key - UUID';
COMMENT ON COLUMN weekly_summaries.summary_date IS 'Date of summary (usually end of week)';
COMMENT ON COLUMN weekly_summaries.summary_type IS 'admin, doctor, billing, inventory';
COMMENT ON COLUMN weekly_summaries.recipient_email IS 'Recipient email address';
COMMENT ON COLUMN weekly_summaries.recipient_name IS 'Recipient name';
COMMENT ON COLUMN weekly_summaries.summary_pdf_url IS 'URL to summary PDF';
COMMENT ON COLUMN weekly_summaries.stats_json IS 'Statistics in JSON format';
COMMENT ON COLUMN weekly_summaries.metrics IS 'Metrics in JSON format';
COMMENT ON COLUMN weekly_summaries.charts IS 'Chart data in JSON format';
COMMENT ON COLUMN weekly_summaries.sent_at IS 'When summary was sent';
COMMENT ON COLUMN weekly_summaries.opened_at IS 'When summary was opened';
COMMENT ON COLUMN weekly_summaries.status IS 'pending, sent, failed, opened';
COMMENT ON COLUMN weekly_summaries.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_type ON weekly_summaries(summary_type);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_status ON weekly_summaries(status);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_date ON weekly_summaries(summary_date);

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
        REFERENCES test_results(id) ON DELETE SET NULL,
    CONSTRAINT check_lab_report_status CHECK (status IN ('pending', 'sent', 'failed', 'opened')),
    CONSTRAINT check_email_format_lab CHECK (patient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE lab_reports_email IS 'Lab reports sent via email';
COMMENT ON COLUMN lab_reports_email.id IS 'Primary key - UUID';
COMMENT ON COLUMN lab_reports_email.test_result_id IS 'Foreign key to test_results table';
COMMENT ON COLUMN lab_reports_email.patient_email IS 'Patient email address';
COMMENT ON COLUMN lab_reports_email.patient_name IS 'Patient name';
COMMENT ON COLUMN lab_reports_email.doctor_email IS 'Doctor email for copy';
COMMENT ON COLUMN lab_reports_email.lab_name IS 'Lab name';
COMMENT ON COLUMN lab_reports_email.report_pdf_url IS 'URL to report PDF';
COMMENT ON COLUMN lab_reports_email.report_html_url IS 'URL to report HTML version';
COMMENT ON COLUMN lab_reports_email.email_subject IS 'Email subject line';
COMMENT ON COLUMN lab_reports_email.email_body IS 'Email body content';
COMMENT ON COLUMN lab_reports_email.attachments IS 'Additional attachments in JSON';
COMMENT ON COLUMN lab_reports_email.sent_at IS 'When email was sent';
COMMENT ON COLUMN lab_reports_email.opened_at IS 'When email was opened';
COMMENT ON COLUMN lab_reports_email.status IS 'pending, sent, failed, opened';
COMMENT ON COLUMN lab_reports_email.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_lab_reports_email_status ON lab_reports_email(status);
CREATE INDEX IF NOT EXISTS idx_lab_reports_email_sent ON lab_reports_email(sent_at);

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
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT check_payment_gateway CHECK (payment_gateway IN ('razorpay', 'stripe', 'phonepe', 'paytm')),
    CONSTRAINT check_payment_method_online CHECK (payment_method IN ('card', 'upi', 'netbanking', 'wallet')),
    CONSTRAINT check_payment_status_online CHECK (payment_status IN ('initiated', 'pending', 'success', 'failed')),
    CONSTRAINT check_amount_positive CHECK (amount >= 0)
);

COMMENT ON TABLE online_payments IS 'Online payment transactions';
COMMENT ON COLUMN online_payments.id IS 'Primary key - UUID';
COMMENT ON COLUMN online_payments.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN online_payments.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN online_payments.payment_gateway IS 'razorpay, stripe, phonepe, paytm';
COMMENT ON COLUMN online_payments.gateway_transaction_id IS 'Transaction ID from payment gateway';
COMMENT ON COLUMN online_payments.order_id IS 'Order ID from payment gateway';
COMMENT ON COLUMN online_payments.amount IS 'Payment amount';
COMMENT ON COLUMN online_payments.currency IS 'Currency code (INR, USD, etc.)';
COMMENT ON COLUMN online_payments.payment_method IS 'card, upi, netbanking, wallet';
COMMENT ON COLUMN online_payments.payment_status IS 'initiated, pending, success, failed';
COMMENT ON COLUMN online_payments.gateway_response IS 'Full response from payment gateway';
COMMENT ON COLUMN online_payments.error_message IS 'Error message if payment failed';
COMMENT ON COLUMN online_payments.initiated_at IS 'When payment was initiated';
COMMENT ON COLUMN online_payments.completed_at IS 'When payment was completed';
COMMENT ON COLUMN online_payments.refund_id IS 'Refund ID if payment was refunded';
COMMENT ON COLUMN online_payments.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN online_payments.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_online_payments_gateway_transaction ON online_payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_online_payments_status ON online_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_online_payments_created ON online_payments(created_at);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_refund_status CHECK (refund_status IN ('initiated', 'processing', 'completed', 'failed')),
    CONSTRAINT check_refund_amount CHECK (refund_amount >= 0)
);

COMMENT ON TABLE refund_processing IS 'Refund processing tracking';
COMMENT ON COLUMN refund_processing.id IS 'Primary key - UUID';
COMMENT ON COLUMN refund_processing.payment_id IS 'Foreign key to online_payments table';
COMMENT ON COLUMN refund_processing.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN refund_processing.refund_amount IS 'Amount to refund';
COMMENT ON COLUMN refund_processing.refund_reason IS 'Reason for refund';
COMMENT ON COLUMN refund_processing.refund_status IS 'initiated, processing, completed, failed';
COMMENT ON COLUMN refund_processing.gateway_refund_id IS 'Refund ID from payment gateway';
COMMENT ON COLUMN refund_processing.initiated_by IS 'User who initiated refund';
COMMENT ON COLUMN refund_processing.approved_by IS 'User who approved refund';
COMMENT ON COLUMN refund_processing.initiated_at IS 'When refund was initiated';
COMMENT ON COLUMN refund_processing.processed_at IS 'When refund was processed';
COMMENT ON COLUMN refund_processing.completed_at IS 'When refund was completed';
COMMENT ON COLUMN refund_processing.gateway_response IS 'Response from payment gateway';
COMMENT ON COLUMN refund_processing.error_message IS 'Error message if refund failed';
COMMENT ON COLUMN refund_processing.notes IS 'Additional notes';
COMMENT ON COLUMN refund_processing.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_refund_processing_status ON refund_processing(refund_status);
CREATE INDEX IF NOT EXISTS idx_refund_processing_gateway_refund ON refund_processing(gateway_refund_id);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_verification_method CHECK (verification_method IN ('webhook', 'callback', 'manual')),
    CONSTRAINT check_verification_status CHECK (verification_status IN ('pending', 'verified', 'failed')),
    CONSTRAINT check_attempts CHECK (attempts_count >= 0)
);

COMMENT ON TABLE payment_verification IS 'Payment verification records';
COMMENT ON COLUMN payment_verification.id IS 'Primary key - UUID';
COMMENT ON COLUMN payment_verification.payment_id IS 'Foreign key to online_payments table';
COMMENT ON COLUMN payment_verification.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN payment_verification.verification_method IS 'webhook, callback, manual';
COMMENT ON COLUMN payment_verification.verification_status IS 'pending, verified, failed';
COMMENT ON COLUMN payment_verification.webhook_payload IS 'Webhook payload from payment gateway';
COMMENT ON COLUMN payment_verification.callback_response IS 'Callback response from payment gateway';
COMMENT ON COLUMN payment_verification.signature_verified IS 'Whether signature was verified';
COMMENT ON COLUMN payment_verification.verified_by IS 'User who manually verified';
COMMENT ON COLUMN payment_verification.verified_at IS 'When verification was done';
COMMENT ON COLUMN payment_verification.attempts_count IS 'Number of verification attempts';
COMMENT ON COLUMN payment_verification.error_message IS 'Error message if verification failed';
COMMENT ON COLUMN payment_verification.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_payment_verification_status ON payment_verification(verification_status);
CREATE INDEX IF NOT EXISTS idx_payment_verification_payment ON payment_verification(payment_id);

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
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT check_transaction_type CHECK (transaction_type IN ('payment', 'refund', 'chargeback')),
    CONSTRAINT check_amounts CHECK (
        amount >= 0 AND 
        fee_amount >= 0 AND 
        tax_amount >= 0 AND 
        net_amount >= 0
    )
);

COMMENT ON TABLE transaction_history IS 'Complete transaction history';
COMMENT ON COLUMN transaction_history.id IS 'Primary key - UUID';
COMMENT ON COLUMN transaction_history.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN transaction_history.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN transaction_history.transaction_type IS 'payment, refund, chargeback';
COMMENT ON COLUMN transaction_history.gateway IS 'Payment gateway name';
COMMENT ON COLUMN transaction_history.gateway_transaction_id IS 'Transaction ID from gateway';
COMMENT ON COLUMN transaction_history.amount IS 'Transaction amount';
COMMENT ON COLUMN transaction_history.currency IS 'Currency code';
COMMENT ON COLUMN transaction_history.status IS 'Transaction status';
COMMENT ON COLUMN transaction_history.payment_method IS 'Payment method used';
COMMENT ON COLUMN transaction_history.bank_reference_number IS 'Bank reference number';
COMMENT ON COLUMN transaction_history.utr_number IS 'UTR number for bank transfers';
COMMENT ON COLUMN transaction_history.transaction_date IS 'Date of transaction';
COMMENT ON COLUMN transaction_history.settlement_date IS 'Date of settlement';
COMMENT ON COLUMN transaction_history.fee_amount IS 'Gateway fee amount';
COMMENT ON COLUMN transaction_history.tax_amount IS 'Tax on fee';
COMMENT ON COLUMN transaction_history.net_amount IS 'Net amount after fees';
COMMENT ON COLUMN transaction_history.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN transaction_history.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_transaction_history_patient ON transaction_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_gateway_transaction ON transaction_history(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_date ON transaction_history(transaction_date);

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
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT check_method_type CHECK (method_type IN ('card', 'upi', 'netbanking', 'wallet')),
    CONSTRAINT check_expiry_month CHECK (expiry_month IS NULL OR (expiry_month BETWEEN 1 AND 12)),
    CONSTRAINT check_expiry_year CHECK (expiry_year IS NULL OR expiry_year >= EXTRACT(YEAR FROM CURRENT_DATE))
);

COMMENT ON TABLE payment_methods IS 'Saved payment methods for patients';
COMMENT ON COLUMN payment_methods.id IS 'Primary key - UUID';
COMMENT ON COLUMN payment_methods.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN payment_methods.method_type IS 'card, upi, netbanking, wallet';
COMMENT ON COLUMN payment_methods.provider IS 'visa, mastercard, gpay, phonepe, etc.';
COMMENT ON COLUMN payment_methods.token IS 'Tokenized payment information';
COMMENT ON COLUMN payment_methods.masked_details IS 'Masked card/account details';
COMMENT ON COLUMN payment_methods.expiry_month IS 'Expiry month for cards';
COMMENT ON COLUMN payment_methods.expiry_year IS 'Expiry year for cards';
COMMENT ON COLUMN payment_methods.is_default IS 'Whether this is default payment method';
COMMENT ON COLUMN payment_methods.is_active IS 'Whether payment method is active';
COMMENT ON COLUMN payment_methods.last_used IS 'When this method was last used';
COMMENT ON COLUMN payment_methods.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN payment_methods.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN payment_methods.updated_at IS 'Record update timestamp';

CREATE INDEX IF NOT EXISTS idx_payment_methods_patient ON payment_methods(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(is_default) WHERE is_default = TRUE;

-- Trigger for payment_methods updated_at
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_image_type CHECK (image_type IN ('xray', 'mri', 'ct', 'ultrasound')),
    CONSTRAINT check_storage_class CHECK (storage_class IN ('standard', 'infrequent', 'archive')),
    CONSTRAINT check_file_size_positive CHECK (file_size >= 0),
    CONSTRAINT check_version CHECK (version >= 1)
);

COMMENT ON TABLE cloud_images IS 'Medical images stored in cloud storage';
COMMENT ON COLUMN cloud_images.id IS 'Primary key - UUID';
COMMENT ON COLUMN cloud_images.image_type IS 'xray, mri, ct, ultrasound';
COMMENT ON COLUMN cloud_images.reference_id IS 'Reference ID to radiology_images table';
COMMENT ON COLUMN cloud_images.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN cloud_images.bucket_name IS 'Cloud storage bucket name';
COMMENT ON COLUMN cloud_images.object_key IS 'Unique object key in bucket';
COMMENT ON COLUMN cloud_images.file_name IS 'Original file name';
COMMENT ON COLUMN cloud_images.file_size IS 'File size in bytes';
COMMENT ON COLUMN cloud_images.mime_type IS 'MIME type of file';
COMMENT ON COLUMN cloud_images.storage_class IS 'standard, infrequent, archive';
COMMENT ON COLUMN cloud_images.public_url IS 'Public URL for image';
COMMENT ON COLUMN cloud_images.thumbnail_url IS 'URL for thumbnail';
COMMENT ON COLUMN cloud_images.encryption_status IS 'Encryption status';
COMMENT ON COLUMN cloud_images.checksum IS 'File checksum for integrity';
COMMENT ON COLUMN cloud_images.version IS 'Version number';
COMMENT ON COLUMN cloud_images.tags IS 'Tags for categorization';
COMMENT ON COLUMN cloud_images.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN cloud_images.uploaded_by IS 'User who uploaded';
COMMENT ON COLUMN cloud_images.uploaded_at IS 'When uploaded';
COMMENT ON COLUMN cloud_images.last_accessed IS 'Last accessed timestamp';
COMMENT ON COLUMN cloud_images.expires_at IS 'Expiry timestamp';
COMMENT ON COLUMN cloud_images.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN cloud_images.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_cloud_images_patient ON cloud_images(patient_id);
CREATE INDEX IF NOT EXISTS idx_cloud_images_object_key ON cloud_images(object_key);
CREATE INDEX IF NOT EXISTS idx_cloud_images_expires ON cloud_images(expires_at);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_report_type CHECK (report_type IN ('lab', 'radiology', 'prescription', 'invoice')),
    CONSTRAINT check_file_size_positive_report CHECK (file_size >= 0),
    CONSTRAINT check_page_count CHECK (page_count >= 0),
    CONSTRAINT check_version_report CHECK (version >= 1),
    CONSTRAINT check_downloaded_count CHECK (downloaded_count >= 0)
);

COMMENT ON TABLE cloud_reports IS 'Report PDFs stored in cloud storage';
COMMENT ON COLUMN cloud_reports.id IS 'Primary key - UUID';
COMMENT ON COLUMN cloud_reports.report_type IS 'lab, radiology, prescription, invoice';
COMMENT ON COLUMN cloud_reports.reference_id IS 'Reference ID to specific report table';
COMMENT ON COLUMN cloud_reports.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN cloud_reports.bucket_name IS 'Cloud storage bucket name';
COMMENT ON COLUMN cloud_reports.object_key IS 'Unique object key in bucket';
COMMENT ON COLUMN cloud_reports.file_name IS 'Original file name';
COMMENT ON COLUMN cloud_reports.file_size IS 'File size in bytes';
COMMENT ON COLUMN cloud_reports.page_count IS 'Number of pages in PDF';
COMMENT ON COLUMN cloud_reports.mime_type IS 'MIME type of file';
COMMENT ON COLUMN cloud_reports.storage_class IS 'Storage class';
COMMENT ON COLUMN cloud_reports.public_url IS 'Public URL for report';
COMMENT ON COLUMN cloud_reports.password_protected IS 'Whether PDF is password protected';
COMMENT ON COLUMN cloud_reports.encryption_status IS 'Encryption status';
COMMENT ON COLUMN cloud_reports.checksum IS 'File checksum for integrity';
COMMENT ON COLUMN cloud_reports.version IS 'Version number';
COMMENT ON COLUMN cloud_reports.tags IS 'Tags for categorization';
COMMENT ON COLUMN cloud_reports.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN cloud_reports.uploaded_by IS 'User who uploaded';
COMMENT ON COLUMN cloud_reports.uploaded_at IS 'When uploaded';
COMMENT ON COLUMN cloud_reports.downloaded_count IS 'Number of times downloaded';
COMMENT ON COLUMN cloud_reports.last_accessed IS 'Last accessed timestamp';
COMMENT ON COLUMN cloud_reports.expires_at IS 'Expiry timestamp';
COMMENT ON COLUMN cloud_reports.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN cloud_reports.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_cloud_reports_patient ON cloud_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_cloud_reports_object_key ON cloud_reports(object_key);
CREATE INDEX IF NOT EXISTS idx_cloud_reports_expires ON cloud_reports(expires_at);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_backup_type CHECK (backup_type IN ('full', 'incremental', 'differential')),
    CONSTRAINT check_compression_type CHECK (compression_type IN ('gzip', 'zstd', 'none')),
    CONSTRAINT check_encryption_type CHECK (encryption_type IN ('aes256', 'none')),
    CONSTRAINT check_backup_status CHECK (status IN ('in_progress', 'completed', 'failed')),
    CONSTRAINT check_file_size_backup CHECK (file_size >= 0),
    CONSTRAINT check_duration CHECK (duration_seconds >= 0),
    CONSTRAINT check_retention_days CHECK (retention_days >= 0)
);

COMMENT ON TABLE backups IS 'Database backup records';
COMMENT ON COLUMN backups.id IS 'Primary key - UUID';
COMMENT ON COLUMN backups.backup_type IS 'full, incremental, differential';
COMMENT ON COLUMN backups.backup_name IS 'Backup name';
COMMENT ON COLUMN backups.database_name IS 'Database name';
COMMENT ON COLUMN backups.bucket_name IS 'Cloud storage bucket name';
COMMENT ON COLUMN backups.object_key IS 'Unique object key in bucket';
COMMENT ON COLUMN backups.file_size IS 'File size in bytes';
COMMENT ON COLUMN backups.compression_type IS 'gzip, zstd, none';
COMMENT ON COLUMN backups.encryption_type IS 'aes256, none';
COMMENT ON COLUMN backups.checksum IS 'File checksum for integrity';
COMMENT ON COLUMN backups.status IS 'in_progress, completed, failed';
COMMENT ON COLUMN backups.started_at IS 'When backup started';
COMMENT ON COLUMN backups.completed_at IS 'When backup completed';
COMMENT ON COLUMN backups.duration_seconds IS 'Duration in seconds';
COMMENT ON COLUMN backups.verified_at IS 'When backup was verified';
COMMENT ON COLUMN backups.verified_by IS 'User who verified backup';
COMMENT ON COLUMN backups.retention_days IS 'Retention period in days';
COMMENT ON COLUMN backups.expires_at IS 'When backup expires';
COMMENT ON COLUMN backups.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN backups.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_expires ON backups(expires_at);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_archive_type CHECK (archive_type IN ('images', 'reports', 'logs')),
    CONSTRAINT check_archive_status CHECK (status IN ('pending', 'processing', 'completed')),
    CONSTRAINT check_object_count CHECK (object_count >= 0),
    CONSTRAINT check_total_size CHECK (total_size >= 0),
    CONSTRAINT check_retention_years CHECK (retention_years >= 0)
);

COMMENT ON TABLE archives IS 'Archived files records';
COMMENT ON COLUMN archives.id IS 'Primary key - UUID';
COMMENT ON COLUMN archives.archive_type IS 'images, reports, logs';
COMMENT ON COLUMN archives.archive_name IS 'Archive name';
COMMENT ON COLUMN archives.source_bucket IS 'Source bucket name';
COMMENT ON COLUMN archives.destination_bucket IS 'Destination bucket name';
COMMENT ON COLUMN archives.object_count IS 'Number of objects archived';
COMMENT ON COLUMN archives.total_size IS 'Total size in bytes';
COMMENT ON COLUMN archives.compression_type IS 'Compression type used';
COMMENT ON COLUMN archives.encryption_type IS 'Encryption type used';
COMMENT ON COLUMN archives.status IS 'pending, processing, completed';
COMMENT ON COLUMN archives.started_at IS 'When archival started';
COMMENT ON COLUMN archives.completed_at IS 'When archival completed';
COMMENT ON COLUMN archives.archived_by IS 'User who initiated archival';
COMMENT ON COLUMN archives.retention_years IS 'Retention period in years';
COMMENT ON COLUMN archives.expires_at IS 'When archive expires';
COMMENT ON COLUMN archives.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN archives.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_archives_status ON archives(status);
CREATE INDEX IF NOT EXISTS idx_archives_expires ON archives(expires_at);

-- ============================================
-- PART 5: INSURANCE API (IR-20 to IR-23)
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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_verification_status CHECK (verification_status IN ('pending', 'verified', 'failed')),
    CONSTRAINT check_eligibility_status CHECK (eligibility_status IN ('eligible', 'ineligible', 'partial'))
);

COMMENT ON TABLE insurance_verifications IS 'Insurance verification records';
COMMENT ON COLUMN insurance_verifications.id IS 'Primary key - UUID';
COMMENT ON COLUMN insurance_verifications.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN insurance_verifications.insurance_provider_id IS 'Foreign key to insurance_providers table';
COMMENT ON COLUMN insurance_verifications.policy_number IS 'Insurance policy number';
COMMENT ON COLUMN insurance_verifications.verification_status IS 'pending, verified, failed';
COMMENT ON COLUMN insurance_verifications.coverage_details IS 'Coverage details in JSON';
COMMENT ON COLUMN insurance_verifications.eligibility_status IS 'eligible, ineligible, partial';
COMMENT ON COLUMN insurance_verifications.verification_date IS 'Date of verification';
COMMENT ON COLUMN insurance_verifications.expiry_date IS 'Verification expiry date';
COMMENT ON COLUMN insurance_verifications.api_request IS 'API request payload';
COMMENT ON COLUMN insurance_verifications.api_response IS 'API response payload';
COMMENT ON COLUMN insurance_verifications.verified_by IS 'User who verified';
COMMENT ON COLUMN insurance_verifications.verified_at IS 'When verified';
COMMENT ON COLUMN insurance_verifications.notes IS 'Additional notes';
COMMENT ON COLUMN insurance_verifications.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_insurance_verifications_patient ON insurance_verifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_verifications_status ON insurance_verifications(verification_status);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_claim_status CHECK (claim_status IN ('draft', 'submitted', 'processing', 'approved', 'rejected')),
    CONSTRAINT check_claim_amount CHECK (claim_amount >= 0),
    CONSTRAINT check_approved_amount CHECK (approved_amount IS NULL OR approved_amount >= 0),
    CONSTRAINT check_dates CHECK (decision_date IS NULL OR decision_date >= submission_date)
);

COMMENT ON TABLE insurance_claims IS 'Insurance claims submissions';
COMMENT ON COLUMN insurance_claims.id IS 'Primary key - UUID';
COMMENT ON COLUMN insurance_claims.claim_number IS 'Unique claim number';
COMMENT ON COLUMN insurance_claims.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN insurance_claims.insurance_provider_id IS 'Foreign key to insurance_providers table';
COMMENT ON COLUMN insurance_claims.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN insurance_claims.claim_amount IS 'Claim amount';
COMMENT ON COLUMN insurance_claims.approved_amount IS 'Approved amount';
COMMENT ON COLUMN insurance_claims.claim_status IS 'draft, submitted, processing, approved, rejected';
COMMENT ON COLUMN insurance_claims.submission_date IS 'Date of submission';
COMMENT ON COLUMN insurance_claims.decision_date IS 'Date of decision';
COMMENT ON COLUMN insurance_claims.documents IS 'Claim documents in JSON';
COMMENT ON COLUMN insurance_claims.api_request IS 'API request payload';
COMMENT ON COLUMN insurance_claims.api_response IS 'API response payload';
COMMENT ON COLUMN insurance_claims.rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN insurance_claims.submitted_by IS 'User who submitted';
COMMENT ON COLUMN insurance_claims.submitted_at IS 'When submitted';
COMMENT ON COLUMN insurance_claims.processed_by IS 'User who processed';
COMMENT ON COLUMN insurance_claims.processed_at IS 'When processed';
COMMENT ON COLUMN insurance_claims.notes IS 'Additional notes';
COMMENT ON COLUMN insurance_claims.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN insurance_claims.updated_at IS 'Record update timestamp';

CREATE INDEX IF NOT EXISTS idx_insurance_claims_number ON insurance_claims(claim_number);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(claim_status);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_service_type CHECK (service_type IN ('consultation', 'lab', 'procedure', 'medicine')),
    CONSTRAINT check_coverage_percentage CHECK (coverage_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_estimated_amount CHECK (estimated_amount >= 0),
    CONSTRAINT check_covered_amount CHECK (covered_amount >= 0),
    CONSTRAINT check_patient_responsibility CHECK (patient_responsibility >= 0),
    CONSTRAINT check_pre_auth_days CHECK (pre_authorization_days >= 0)
);

COMMENT ON TABLE coverage_checks IS 'Insurance coverage checks';
COMMENT ON COLUMN coverage_checks.id IS 'Primary key - UUID';
COMMENT ON COLUMN coverage_checks.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN coverage_checks.insurance_provider_id IS 'Foreign key to insurance_providers table';
COMMENT ON COLUMN coverage_checks.service_type IS 'consultation, lab, procedure, medicine';
COMMENT ON COLUMN coverage_checks.service_code IS 'Service code';
COMMENT ON COLUMN coverage_checks.estimated_amount IS 'Estimated amount';
COMMENT ON COLUMN coverage_checks.coverage_percentage IS 'Coverage percentage';
COMMENT ON COLUMN coverage_checks.covered_amount IS 'Amount covered by insurance';
COMMENT ON COLUMN coverage_checks.patient_responsibility IS 'Amount patient pays';
COMMENT ON COLUMN coverage_checks.pre_authorization_required IS 'Whether pre-authorization required';
COMMENT ON COLUMN coverage_checks.pre_authorization_days IS 'Days needed for pre-authorization';
COMMENT ON COLUMN coverage_checks.exclusions IS 'Exclusions text array';
COMMENT ON COLUMN coverage_checks.limitations IS 'Limitations in JSON';
COMMENT ON COLUMN coverage_checks.api_request IS 'API request payload';
COMMENT ON COLUMN coverage_checks.api_response IS 'API response payload';
COMMENT ON COLUMN coverage_checks.checked_by IS 'User who checked';
COMMENT ON COLUMN coverage_checks.checked_at IS 'When checked';
COMMENT ON COLUMN coverage_checks.valid_until IS 'Validity date';
COMMENT ON COLUMN coverage_checks.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_coverage_checks_patient ON coverage_checks(patient_id);
CREATE INDEX IF NOT EXISTS idx_coverage_checks_valid ON coverage_checks(valid_until);

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
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_tracking_status CHECK (status IN ('submitted', 'under_review', 'additional_info_required', 'approved', 'rejected', 'paid'))
);

COMMENT ON TABLE claim_tracking IS 'Insurance claim status tracking';
COMMENT ON COLUMN claim_tracking.id IS 'Primary key - UUID';
COMMENT ON COLUMN claim_tracking.claim_id IS 'Foreign key to insurance_claims table';
COMMENT ON COLUMN claim_tracking.status IS 'Status of claim';
COMMENT ON COLUMN claim_tracking.status_date IS 'Date of status update';
COMMENT ON COLUMN claim_tracking.status_description IS 'Description of status';
COMMENT ON COLUMN claim_tracking.updated_by IS 'User who updated';
COMMENT ON COLUMN claim_tracking.attachment_urls IS 'URLs to attachment files';
COMMENT ON COLUMN claim_tracking.notes IS 'Additional notes';
COMMENT ON COLUMN claim_tracking.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN claim_tracking.created_at IS 'Record creation timestamp';

CREATE INDEX IF NOT EXISTS idx_claim_tracking_claim ON claim_tracking(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_tracking_status_date ON claim_tracking(status_date);

-- ============================================
-- PART 6: CLINICAL & OPERATIONAL TABLES (NEW)
-- ============================================

-- [TABLE A] diagnosis
CREATE TABLE IF NOT EXISTS diagnosis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    appointment_id UUID,
    
    icd_code VARCHAR(20),
    diagnosis_name VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(20), -- primary/secondary/complication
    severity VARCHAR(20), -- mild/moderate/severe/critical
    status VARCHAR(20), -- active/resolved/chronic
    
    diagnosed_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    follow_up_date DATE,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT fk_diagnosis_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_diagnosis_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_diagnosis_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_diagnosis_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_diagnosis_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_diagnosis_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_diagnosis_type CHECK (type IN ('primary', 'secondary', 'complication')),
    CONSTRAINT check_severity CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    CONSTRAINT check_status CHECK (status IN ('active', 'resolved', 'chronic')),
    CONSTRAINT check_dates CHECK (resolved_at IS NULL OR resolved_at >= diagnosed_at),
    CONSTRAINT check_follow_up CHECK (follow_up_date IS NULL OR follow_up_date >= diagnosed_at::DATE)
);

COMMENT ON TABLE diagnosis IS 'Patient diagnoses with ICD codes and severity tracking';
COMMENT ON COLUMN diagnosis.id IS 'Primary key - UUID';
COMMENT ON COLUMN diagnosis.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN diagnosis.doctor_id IS 'Foreign key to employees table (diagnosing doctor)';
COMMENT ON COLUMN diagnosis.appointment_id IS 'Foreign key to appointments table';
COMMENT ON COLUMN diagnosis.icd_code IS 'ICD-10/ICD-11 code';
COMMENT ON COLUMN diagnosis.diagnosis_name IS 'Name of diagnosis';
COMMENT ON COLUMN diagnosis.description IS 'Detailed description';
COMMENT ON COLUMN diagnosis.type IS 'primary, secondary, complication';
COMMENT ON COLUMN diagnosis.severity IS 'mild, moderate, severe, critical';
COMMENT ON COLUMN diagnosis.status IS 'active, resolved, chronic';
COMMENT ON COLUMN diagnosis.diagnosed_at IS 'When diagnosis was made';
COMMENT ON COLUMN diagnosis.resolved_at IS 'When condition resolved';
COMMENT ON COLUMN diagnosis.follow_up_date IS 'Recommended follow-up date';
COMMENT ON COLUMN diagnosis.notes IS 'Additional notes';
COMMENT ON COLUMN diagnosis.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN diagnosis.updated_at IS 'Record update timestamp';
COMMENT ON COLUMN diagnosis.created_by IS 'User who created record';
COMMENT ON COLUMN diagnosis.updated_by IS 'User who last updated record';
COMMENT ON COLUMN diagnosis.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN diagnosis.deleted_at IS 'Timestamp when soft deleted';
COMMENT ON COLUMN diagnosis.deleted_by IS 'User who soft deleted record';

CREATE INDEX IF NOT EXISTS idx_diagnosis_patient ON diagnosis(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_diagnosis_doctor ON diagnosis(doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_diagnosis_status ON diagnosis(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_diagnosis_diagnosed ON diagnosis(diagnosed_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_diagnosis_deleted ON diagnosis(is_deleted, deleted_at);

-- [TABLE B] visits
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID NOT NULL,
    visit_type VARCHAR(20) NOT NULL, -- opd/ipd/emergency
    visit_date DATE NOT NULL,
    department_id UUID,
    doctor_id UUID,
    
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    status VARCHAR(20), -- scheduled/in-progress/completed
    
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,2),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    
    consultation_fee DECIMAL(10,2),
    is_billed BOOLEAN DEFAULT FALSE,
    invoice_id UUID,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT fk_visits_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_visits_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_visits_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_visit_type CHECK (visit_type IN ('opd', 'ipd', 'emergency')),
    CONSTRAINT check_visit_status CHECK (status IN ('scheduled', 'in-progress', 'completed')),
    CONSTRAINT check_dates CHECK (check_out_time IS NULL OR check_out_time >= check_in_time),
    CONSTRAINT check_vitals CHECK (
        (bp_systolic IS NULL OR (bp_systolic BETWEEN 70 AND 250)) AND
        (bp_diastolic IS NULL OR (bp_diastolic BETWEEN 40 AND 150)) AND
        (heart_rate IS NULL OR (heart_rate BETWEEN 30 AND 250)) AND
        (temperature IS NULL OR (temperature BETWEEN 30 AND 45))
    )
);

COMMENT ON TABLE visits IS 'Patient visit tracking for OPD, IPD, and emergency';
COMMENT ON COLUMN visits.id IS 'Primary key - UUID';
COMMENT ON COLUMN visits.visit_number IS 'Unique visit number';
COMMENT ON COLUMN visits.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN visits.visit_type IS 'opd, ipd, emergency';
COMMENT ON COLUMN visits.visit_date IS 'Date of visit';
COMMENT ON COLUMN visits.department_id IS 'Foreign key to departments table';
COMMENT ON COLUMN visits.doctor_id IS 'Foreign key to employees table (attending doctor)';
COMMENT ON COLUMN visits.check_in_time IS 'Check-in timestamp';
COMMENT ON COLUMN visits.check_out_time IS 'Check-out timestamp';
COMMENT ON COLUMN visits.status IS 'scheduled, in-progress, completed';
COMMENT ON COLUMN visits.bp_systolic IS 'Systolic blood pressure';
COMMENT ON COLUMN visits.bp_diastolic IS 'Diastolic blood pressure';
COMMENT ON COLUMN visits.heart_rate IS 'Heart rate in BPM';
COMMENT ON COLUMN visits.temperature IS 'Body temperature in Celsius';
COMMENT ON COLUMN visits.weight IS 'Weight in kg';
COMMENT ON COLUMN visits.height IS 'Height in cm';
COMMENT ON COLUMN visits.consultation_fee IS 'Consultation fee';
COMMENT ON COLUMN visits.is_billed IS 'Whether visit is billed';
COMMENT ON COLUMN visits.invoice_id IS 'Foreign key to invoices table';
COMMENT ON COLUMN visits.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN visits.updated_at IS 'Record update timestamp';
COMMENT ON COLUMN visits.created_by IS 'User who created record';
COMMENT ON COLUMN visits.updated_by IS 'User who last updated record';
COMMENT ON COLUMN visits.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN visits.deleted_at IS 'Timestamp when soft deleted';
COMMENT ON COLUMN visits.deleted_by IS 'User who soft deleted record';

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_number ON visits(visit_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_deleted ON visits(is_deleted, deleted_at);

-- [TABLE C] clinical_notes
CREATE TABLE IF NOT EXISTS clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    appointment_id UUID,
    
    note_type VARCHAR(20), -- progress/subjective/objective/assessment/plan
    title VARCHAR(500),
    content TEXT NOT NULL,
    is_structured BOOLEAN DEFAULT FALSE,
    sections JSONB, -- for structured notes (SOAP format)
    
    is_urgent BOOLEAN DEFAULT FALSE,
    requires_follow_up BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT fk_clinical_notes_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_clinical_notes_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_clinical_notes_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_clinical_notes_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_clinical_notes_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_clinical_notes_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_note_type CHECK (note_type IN ('progress', 'subjective', 'objective', 'assessment', 'plan')),
    CONSTRAINT check_follow_up CHECK (follow_up_date IS NULL OR follow_up_date >= CURRENT_DATE)
);

COMMENT ON TABLE clinical_notes IS 'Clinical notes in SOAP format';
COMMENT ON COLUMN clinical_notes.id IS 'Primary key - UUID';
COMMENT ON COLUMN clinical_notes.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN clinical_notes.doctor_id IS 'Foreign key to employees table (author)';
COMMENT ON COLUMN clinical_notes.appointment_id IS 'Foreign key to appointments table';
COMMENT ON COLUMN clinical_notes.note_type IS 'progress, subjective, objective, assessment, plan';
COMMENT ON COLUMN clinical_notes.title IS 'Note title';
COMMENT ON COLUMN clinical_notes.content IS 'Note content';
COMMENT ON COLUMN clinical_notes.is_structured IS 'True if notes are in structured SOAP format';
COMMENT ON COLUMN clinical_notes.sections IS 'Structured sections in JSON (SOAP format)';
COMMENT ON COLUMN clinical_notes.is_urgent IS 'Whether note is urgent';
COMMENT ON COLUMN clinical_notes.requires_follow_up IS 'Whether follow-up required';
COMMENT ON COLUMN clinical_notes.follow_up_date IS 'Follow-up date';
COMMENT ON COLUMN clinical_notes.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN clinical_notes.updated_at IS 'Record update timestamp';
COMMENT ON COLUMN clinical_notes.created_by IS 'User who created record';
COMMENT ON COLUMN clinical_notes.updated_by IS 'User who last updated record';
COMMENT ON COLUMN clinical_notes.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN clinical_notes.deleted_at IS 'Timestamp when soft deleted';
COMMENT ON COLUMN clinical_notes.deleted_by IS 'User who soft deleted record';

CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_doctor ON clinical_notes(doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON clinical_notes(note_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_urgent ON clinical_notes(is_urgent) WHERE is_urgent = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_created ON clinical_notes(created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_deleted ON clinical_notes(is_deleted, deleted_at);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_sections ON clinical_notes USING gin(sections);

-- [TABLE D] medications (MAR - Medication Administration Record)
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    prescription_id UUID,
    medicine_id UUID,
    medicine_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    route VARCHAR(50), -- oral/IV/IM/subcutaneous/topical
    
    scheduled_time TIMESTAMP NOT NULL,
    scheduled_dose VARCHAR(50) NOT NULL,
    status VARCHAR(20), -- pending/administered/skipped/rescheduled
    
    administered_by UUID,
    administered_at TIMESTAMP,
    administered_dose VARCHAR(50),
    notes TEXT,
    reactions JSONB,
    
    skip_reason TEXT,
    rescheduled_to TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_medications_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_medications_prescription FOREIGN KEY (prescription_id) 
        REFERENCES prescriptions(id) ON DELETE SET NULL,
    CONSTRAINT fk_medications_medicine FOREIGN KEY (medicine_id) 
        REFERENCES inventory(id) ON DELETE SET NULL,
    CONSTRAINT fk_medications_administered_by FOREIGN KEY (administered_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_medication_status CHECK (status IN ('pending', 'administered', 'skipped', 'rescheduled')),
    CONSTRAINT check_route CHECK (route IN ('oral', 'IV', 'IM', 'subcutaneous', 'topical')),
    CONSTRAINT check_administered CHECK (
        (status = 'administered' AND administered_by IS NOT NULL AND administered_at IS NOT NULL) OR
        (status != 'administered')
    ),
    CONSTRAINT check_skipped CHECK (
        (status = 'skipped' AND skip_reason IS NOT NULL) OR
        (status != 'skipped')
    )
);

COMMENT ON TABLE medications IS 'Medication Administration Record (MAR) for inpatients';
COMMENT ON COLUMN medications.id IS 'Primary key - UUID';
COMMENT ON COLUMN medications.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN medications.prescription_id IS 'Foreign key to prescriptions table';
COMMENT ON COLUMN medications.medicine_id IS 'Foreign key to inventory table';
COMMENT ON COLUMN medications.medicine_name IS 'Name of medicine';
COMMENT ON COLUMN medications.dosage IS 'Dosage';
COMMENT ON COLUMN medications.route IS 'oral, IV, IM, subcutaneous, topical';
COMMENT ON COLUMN medications.scheduled_time IS 'Scheduled administration time';
COMMENT ON COLUMN medications.scheduled_dose IS 'Scheduled dose';
COMMENT ON COLUMN medications.status IS 'pending, administered, skipped, rescheduled';
COMMENT ON COLUMN medications.administered_by IS 'User who administered';
COMMENT ON COLUMN medications.administered_at IS 'When administered';
COMMENT ON COLUMN medications.administered_dose IS 'Actual dose given';
COMMENT ON COLUMN medications.notes IS 'Administration notes';
COMMENT ON COLUMN medications.reactions IS 'Reactions in JSON';
COMMENT ON COLUMN medications.skip_reason IS 'Reason for skipping';
COMMENT ON COLUMN medications.rescheduled_to IS 'Rescheduled time';
COMMENT ON COLUMN medications.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN medications.updated_at IS 'Record update timestamp';

CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_scheduled ON medications(scheduled_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);
CREATE INDEX IF NOT EXISTS idx_medications_administered ON medications(administered_at) WHERE administered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medications_reactions ON medications USING gin(reactions);

-- [TABLE E] handover_notes
CREATE TABLE IF NOT EXISTS handover_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_shift_id UUID,
    to_shift_id UUID,
    from_nurse_id UUID NOT NULL,
    to_nurse_id UUID,
    
    handover_time TIMESTAMP NOT NULL,
    content TEXT NOT NULL,
    priority_patients JSONB,
    pending_tasks JSONB,
    alerts JSONB,
    equipment_issues TEXT,
    
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID,
    attachment_urls TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_handover_from_shift FOREIGN KEY (from_shift_id) 
        REFERENCES shifts(id) ON DELETE SET NULL,
    CONSTRAINT fk_handover_to_shift FOREIGN KEY (to_shift_id) 
        REFERENCES shifts(id) ON DELETE SET NULL,
    CONSTRAINT fk_handover_from_nurse FOREIGN KEY (from_nurse_id) 
        REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_handover_to_nurse FOREIGN KEY (to_nurse_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_handover_acknowledged_by FOREIGN KEY (acknowledged_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_acknowledgment CHECK (
        (is_acknowledged = TRUE AND acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL) OR
        (is_acknowledged = FALSE)
    )
);

COMMENT ON TABLE handover_notes IS 'Nurse shift handover notes for patient handoff';
COMMENT ON COLUMN handover_notes.id IS 'Primary key - UUID';
COMMENT ON COLUMN handover_notes.from_shift_id IS 'Foreign key to shifts table (ending shift)';
COMMENT ON COLUMN handover_notes.to_shift_id IS 'Foreign key to shifts table (starting shift)';
COMMENT ON COLUMN handover_notes.from_nurse_id IS 'Foreign key to employees table (outgoing nurse)';
COMMENT ON COLUMN handover_notes.to_nurse_id IS 'Foreign key to employees table (incoming nurse)';
COMMENT ON COLUMN handover_notes.handover_time IS 'Time of handover';
COMMENT ON COLUMN handover_notes.content IS 'Handover content';
COMMENT ON COLUMN handover_notes.priority_patients IS 'Priority patients in JSON';
COMMENT ON COLUMN handover_notes.pending_tasks IS 'Pending tasks in JSON';
COMMENT ON COLUMN handover_notes.alerts IS 'Alerts in JSON';
COMMENT ON COLUMN handover_notes.equipment_issues IS 'Equipment issues';
COMMENT ON COLUMN handover_notes.is_acknowledged IS 'Whether receiving nurse acknowledged';
COMMENT ON COLUMN handover_notes.acknowledged_at IS 'When acknowledged';
COMMENT ON COLUMN handover_notes.acknowledged_by IS 'User who acknowledged';
COMMENT ON COLUMN handover_notes.attachment_urls IS 'Attachment URLs';
COMMENT ON COLUMN handover_notes.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN handover_notes.updated_at IS 'Record update timestamp';

CREATE INDEX IF NOT EXISTS idx_handover_from_shift ON handover_notes(from_shift_id);
CREATE INDEX IF NOT EXISTS idx_handover_to_shift ON handover_notes(to_shift_id);
CREATE INDEX IF NOT EXISTS idx_handover_time ON handover_notes(handover_time);
CREATE INDEX IF NOT EXISTS idx_handover_acknowledged ON handover_notes(is_acknowledged) WHERE is_acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_handover_priority_patients ON handover_notes USING gin(priority_patients);
CREATE INDEX IF NOT EXISTS idx_handover_pending_tasks ON handover_notes USING gin(pending_tasks);
CREATE INDEX IF NOT EXISTS idx_handover_alerts ON handover_notes USING gin(alerts);

-- [TABLE F] transport_requests
CREATE TABLE IF NOT EXISTS transport_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    request_type VARCHAR(20) NOT NULL, -- patient/sample/equipment/document
    
    requested_by UUID NOT NULL,
    requested_at TIMESTAMP NOT NULL,
    department_id UUID,
    priority VARCHAR(20), -- low/medium/high/urgent
    is_emergency BOOLEAN DEFAULT FALSE,
    
    patient_id UUID,
    from_location VARCHAR(200) NOT NULL,
    to_location VARCHAR(200) NOT NULL,
    
    item_type VARCHAR(50),
    item_id UUID,
    quantity INTEGER,
    
    assigned_to UUID,
    assigned_at TIMESTAMP,
    
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20), -- pending/accepted/in-progress/completed/cancelled
    
    special_instructions TEXT,
    completion_notes TEXT,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT fk_transport_requested_by FOREIGN KEY (requested_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transport_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_transport_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_transport_assigned_to FOREIGN KEY (assigned_to) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_transport_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_transport_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_transport_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_request_type CHECK (request_type IN ('patient', 'sample', 'equipment', 'document')),
    CONSTRAINT check_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'accepted', 'in-progress', 'completed', 'cancelled')),
    CONSTRAINT check_dates CHECK (
        (accepted_at IS NULL OR accepted_at >= requested_at) AND
        (started_at IS NULL OR started_at >= accepted_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    ),
    CONSTRAINT check_quantity CHECK (quantity IS NULL OR quantity > 0)
);

COMMENT ON TABLE transport_requests IS 'Transport requests for patients, samples, equipment, and documents';
COMMENT ON COLUMN transport_requests.id IS 'Primary key - UUID';
COMMENT ON COLUMN transport_requests.request_number IS 'Unique request number';
COMMENT ON COLUMN transport_requests.request_type IS 'patient, sample, equipment, document';
COMMENT ON COLUMN transport_requests.requested_by IS 'User who requested';
COMMENT ON COLUMN transport_requests.requested_at IS 'When requested';
COMMENT ON COLUMN transport_requests.department_id IS 'Department requesting';
COMMENT ON COLUMN transport_requests.priority IS 'low, medium, high, urgent';
COMMENT ON COLUMN transport_requests.is_emergency IS 'Emergency flag';
COMMENT ON COLUMN transport_requests.patient_id IS 'Patient ID if transporting patient';
COMMENT ON COLUMN transport_requests.from_location IS 'Pickup location';
COMMENT ON COLUMN transport_requests.to_location IS 'Dropoff location';
COMMENT ON COLUMN transport_requests.item_type IS 'Type of item if transporting item';
COMMENT ON COLUMN transport_requests.item_id IS 'Item ID';
COMMENT ON COLUMN transport_requests.quantity IS 'Quantity';
COMMENT ON COLUMN transport_requests.assigned_to IS 'Staff assigned';
COMMENT ON COLUMN transport_requests.assigned_at IS 'When assigned';
COMMENT ON COLUMN transport_requests.accepted_at IS 'When accepted';
COMMENT ON COLUMN transport_requests.started_at IS 'When started';
COMMENT ON COLUMN transport_requests.completed_at IS 'When completed';
COMMENT ON COLUMN transport_requests.status IS 'pending, accepted, in-progress, completed, cancelled';
COMMENT ON COLUMN transport_requests.special_instructions IS 'Special instructions';
COMMENT ON COLUMN transport_requests.completion_notes IS 'Completion notes';
COMMENT ON COLUMN transport_requests.cancellation_reason IS 'Cancellation reason';
COMMENT ON COLUMN transport_requests.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN transport_requests.updated_at IS 'Record update timestamp';
COMMENT ON COLUMN transport_requests.created_by IS 'User who created record';
COMMENT ON COLUMN transport_requests.updated_by IS 'User who updated record';
COMMENT ON COLUMN transport_requests.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN transport_requests.deleted_at IS 'When soft deleted';
COMMENT ON COLUMN transport_requests.deleted_by IS 'User who soft deleted';

CREATE INDEX IF NOT EXISTS idx_transport_number ON transport_requests(request_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_type ON transport_requests(request_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_status ON transport_requests(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_priority ON transport_requests(priority) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_assigned ON transport_requests(assigned_to) WHERE assigned_to IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_emergency ON transport_requests(is_emergency) WHERE is_emergency = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_created ON transport_requests(created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_transport_deleted ON transport_requests(is_deleted, deleted_at);

-- ============================================
-- PART 7: UPDATED_AT TRIGGERS FOR NEW TABLES
-- ============================================

-- Trigger for diagnosis
DROP TRIGGER IF EXISTS update_diagnosis_updated_at ON diagnosis;
CREATE TRIGGER update_diagnosis_updated_at
    BEFORE UPDATE ON diagnosis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for visits
DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
CREATE TRIGGER update_visits_updated_at
    BEFORE UPDATE ON visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for clinical_notes
DROP TRIGGER IF EXISTS update_clinical_notes_updated_at ON clinical_notes;
CREATE TRIGGER update_clinical_notes_updated_at
    BEFORE UPDATE ON clinical_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for medications
DROP TRIGGER IF EXISTS update_medications_updated_at ON medications;
CREATE TRIGGER update_medications_updated_at
    BEFORE UPDATE ON medications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for handover_notes
DROP TRIGGER IF EXISTS update_handover_notes_updated_at ON handover_notes;
CREATE TRIGGER update_handover_notes_updated_at
    BEFORE UPDATE ON handover_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for transport_requests
DROP TRIGGER IF EXISTS update_transport_requests_updated_at ON transport_requests;
CREATE TRIGGER update_transport_requests_updated_at
    BEFORE UPDATE ON transport_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 8: VERIFICATION (UPDATED)
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
    new_table_count INTEGER;
    total_count INTEGER;
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
    
    SELECT COUNT(*) INTO new_table_count 
    FROM information_schema.tables 
    WHERE table_name IN (
        'diagnosis', 'visits', 'clinical_notes', 'medications', 'handover_notes', 'transport_requests'
    );
    
    total_count := table_count + new_table_count;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'INTEGRATION TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Original tables: %', table_count;
    RAISE NOTICE 'New clinical/operational tables: %', new_table_count;
    RAISE NOTICE 'TOTAL TABLES: %', total_count;
    RAISE NOTICE '';
    RAISE NOTICE 'SMS Gateway: 5 tables';
    RAISE NOTICE 'Email Service: 5 tables';
    RAISE NOTICE 'Payment Gateway: 5 tables';
    RAISE NOTICE 'Cloud Storage: 4 tables';
    RAISE NOTICE 'Insurance API: 4 tables';
    RAISE NOTICE 'Clinical & Operational: 6 tables';
    RAISE NOTICE '============================================';
END $$;