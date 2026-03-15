-- ============================================
-- MIGRATION: 011_create_invoices.sql
-- DESCRIPTION: Create invoices table with complete billing management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: patients table, appointments table, insurance_providers table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create invoice_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
        CREATE TYPE invoice_status_enum AS ENUM (
            'draft',
            'submitted',
            'pending_approval',
            'approved',
            'sent',
            'partial',
            'paid',
            'overdue',
            'cancelled',
            'refunded',
            'disputed'
        );
        RAISE NOTICE 'Created invoice_status_enum type';
    END IF;
END $$;

-- Create payment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        CREATE TYPE payment_status_enum AS ENUM (
            'pending',
            'partial',
            'paid',
            'overdue',
            'refunded'
        );
        RAISE NOTICE 'Created payment_status_enum type';
    END IF;
END $$;

-- Create payment_method enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
        CREATE TYPE payment_method_enum AS ENUM (
            'cash',
            'card',
            'upi',
            'bank_transfer',
            'cheque',
            'insurance',
            'online',
            'wallet'
        );
        RAISE NOTICE 'Created payment_method_enum type';
    END IF;
END $$;

-- Create invoice_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type_enum') THEN
        CREATE TYPE invoice_type_enum AS ENUM (
            'consultation',
            'procedure',
            'surgery',
            'lab',
            'pharmacy',
            'room_charges',
            'package',
            'subscription'
        );
        RAISE NOTICE 'Created invoice_type_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID NOT NULL,
    appointment_id UUID,
    
    -- ========================================
    -- INVOICE DETAILS
    -- ========================================
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    invoice_type invoice_type_enum DEFAULT 'consultation',
    billing_cycle VARCHAR(50),
    period_start DATE,
    period_end DATE,
    
    -- ========================================
    -- FINANCIAL DETAILS
    -- ========================================
    subtotal DECIMAL(12,2) NOT NULL,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    tax_details JSONB,
    discount DECIMAL(12,2) DEFAULT 0,
    discount_type VARCHAR(20),
    discount_reason TEXT,
    total DECIMAL(12,2) NOT NULL,
    rounding_adjustment DECIMAL(5,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    
    -- ========================================
    -- PAYMENT DETAILS
    -- ========================================
    paid_amount DECIMAL(12,2) DEFAULT 0,
    balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total - paid_amount) STORED,
    payment_status payment_status_enum DEFAULT 'pending',
    payment_method payment_method_enum,
    payment_date TIMESTAMP,
    payment_transaction_id VARCHAR(100),
    payment_gateway VARCHAR(50),
    payment_notes TEXT,
    payment_history JSONB,
    
    -- ========================================
    -- INSURANCE DETAILS
    -- ========================================
    insurance_id UUID,
    insurance_claim_number VARCHAR(100),
    insurance_coverage DECIMAL(5,2),
    insurance_amount DECIMAL(12,2),
    insurance_approved BOOLEAN DEFAULT FALSE,
    insurance_approved_by UUID,
    insurance_approved_at TIMESTAMP,
    insurance_claim_status VARCHAR(50),
    insurance_notes TEXT,
    
    -- ========================================
    -- LINE ITEMS
    -- ========================================
    items JSONB NOT NULL,
    item_count INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    
    -- ========================================
    -- DOCUMENTS
    -- ========================================
    invoice_pdf_url TEXT,
    invoice_html_url TEXT,
    receipt_url TEXT,
    supporting_documents JSONB,
    
    -- ========================================
    -- REFUND DETAILS
    -- ========================================
    refund_amount DECIMAL(12,2) DEFAULT 0,
    refund_date TIMESTAMP,
    refund_reason TEXT,
    refund_approved_by UUID,
    refund_approved_at TIMESTAMP,
    refund_transaction_id VARCHAR(100),
    refund_history JSONB,
    
    -- ========================================
    -- APPROVAL WORKFLOW
    -- ========================================
    status invoice_status_enum DEFAULT 'draft',
    approval_level INTEGER DEFAULT 0,
    submitted_by UUID,
    submitted_at TIMESTAMP,
    approved_by UUID,
    approved_at TIMESTAMP,
    rejected_by UUID,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    -- ========================================
    -- COMMUNICATION
    -- ========================================
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMP,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    whatsapp_sent_at TIMESTAMP,
    
    -- ========================================
    -- NOTES & METADATA
    -- ========================================
    notes TEXT,
    terms_conditions TEXT,
    footer_text TEXT,
    metadata JSONB,
    
    -- ========================================
    -- AUDIT
    -- ========================================
    created_by UUID,
    updated_by UUID,
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
    CONSTRAINT fk_invoices_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_insurance FOREIGN KEY (insurance_id) 
        REFERENCES insurance_providers(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_submitted_by FOREIGN KEY (submitted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_rejected_by FOREIGN KEY (rejected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_cancelled_by FOREIGN KEY (cancelled_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_refund_approved_by FOREIGN KEY (refund_approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_insurance_approved_by FOREIGN KEY (insurance_approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (due_date >= issue_date),
    CONSTRAINT check_amounts CHECK (subtotal >= 0 AND tax >= 0 AND discount >= 0),
    CONSTRAINT check_total CHECK (total = subtotal - discount + tax + rounding_adjustment),
    CONSTRAINT check_paid CHECK (paid_amount >= 0 AND paid_amount <= total),
    CONSTRAINT check_refund CHECK (refund_amount >= 0 AND refund_amount <= paid_amount),
    CONSTRAINT check_insurance CHECK (insurance_coverage BETWEEN 0 AND 100),
    CONSTRAINT check_item_count CHECK (item_count >= 0),
    CONSTRAINT check_quantity CHECK (total_quantity >= 0),
    CONSTRAINT check_approval_level CHECK (approval_level >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON invoices(appointment_id) WHERE appointment_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start) WHERE period_start IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_period_end ON invoices(period_end) WHERE period_end IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type) WHERE is_deleted = FALSE;

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_invoices_total ON invoices(total) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_paid_amount ON invoices(paid_amount) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_balance ON invoices(balance_amount) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency) WHERE is_deleted = FALSE;

-- Insurance indexes
CREATE INDEX IF NOT EXISTS idx_invoices_insurance_id ON invoices(insurance_id) WHERE insurance_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_insurance_claim ON invoices(insurance_claim_number) WHERE insurance_claim_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_insurance_status ON invoices(insurance_claim_status) WHERE insurance_claim_status IS NOT NULL AND is_deleted = FALSE;

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method ON invoices(payment_method) WHERE payment_method IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_date ON invoices(payment_date) WHERE payment_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id ON invoices(payment_transaction_id) WHERE payment_transaction_id IS NOT NULL AND is_deleted = FALSE;

-- Approval workflow indexes
CREATE INDEX IF NOT EXISTS idx_invoices_approved_by ON invoices(approved_by) WHERE approved_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_approval_level ON invoices(approval_level) WHERE is_deleted = FALSE;

-- Communication indexes
CREATE INDEX IF NOT EXISTS idx_invoices_email_sent ON invoices(email_sent) WHERE email_sent = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_sms_sent ON invoices(sms_sent) WHERE sms_sent = FALSE AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tax_details ON invoices USING gin(tax_details);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_history ON invoices USING gin(payment_history);
CREATE INDEX IF NOT EXISTS idx_invoices_items ON invoices USING gin(items);
CREATE INDEX IF NOT EXISTS idx_invoices_supporting_documents ON invoices USING gin(supporting_documents);
CREATE INDEX IF NOT EXISTS idx_invoices_refund_history ON invoices USING gin(refund_history);
CREATE INDEX IF NOT EXISTS idx_invoices_metadata ON invoices USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at') THEN
        CREATE TRIGGER update_invoices_updated_at
            BEFORE UPDATE ON invoices
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_invoices_updated_at';
    END IF;
END $$;

-- Function to update payment status based on paid_amount
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.paid_amount >= NEW.total THEN
        NEW.payment_status = 'paid';
        NEW.status = 'paid';
    ELSIF NEW.paid_amount > 0 THEN
        NEW.payment_status = 'partial';
        NEW.status = 'partial';
    ELSE
        NEW.payment_status = 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoice_payment_status') THEN
        CREATE TRIGGER update_invoice_payment_status
            BEFORE INSERT OR UPDATE OF paid_amount, total ON invoices
            FOR EACH ROW
            EXECUTE FUNCTION update_invoice_payment_status();
        RAISE NOTICE 'Created trigger update_invoice_payment_status';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE invoices IS 'Complete invoice and billing management system';
COMMENT ON COLUMN invoices.id IS 'Primary key - UUID';
COMMENT ON COLUMN invoices.invoice_number IS 'Unique invoice number';
COMMENT ON COLUMN invoices.patient_id IS 'Patient being billed';
COMMENT ON COLUMN invoices.appointment_id IS 'Associated appointment';
COMMENT ON COLUMN invoices.issue_date IS 'Date invoice was issued';
COMMENT ON COLUMN invoices.due_date IS 'Payment due date';
COMMENT ON COLUMN invoices.invoice_type IS 'Type of invoice';
COMMENT ON COLUMN invoices.billing_cycle IS 'Billing cycle (monthly/quarterly)';
COMMENT ON COLUMN invoices.period_start IS 'Billing period start';
COMMENT ON COLUMN invoices.period_end IS 'Billing period end';
COMMENT ON COLUMN invoices.subtotal IS 'Subtotal before tax and discount';
COMMENT ON COLUMN invoices.tax_percentage IS 'Tax percentage applied';
COMMENT ON COLUMN invoices.tax IS 'Tax amount';
COMMENT ON COLUMN invoices.tax_details IS 'Tax breakdown in JSON';
COMMENT ON COLUMN invoices.discount IS 'Discount amount';
COMMENT ON COLUMN invoices.discount_type IS 'Discount type (percentage/fixed)';
COMMENT ON COLUMN invoices.discount_reason IS 'Reason for discount';
COMMENT ON COLUMN invoices.total IS 'Total invoice amount';
COMMENT ON COLUMN invoices.rounding_adjustment IS 'Rounding adjustment';
COMMENT ON COLUMN invoices.currency IS 'Currency code';
COMMENT ON COLUMN invoices.exchange_rate IS 'Exchange rate if foreign currency';
COMMENT ON COLUMN invoices.paid_amount IS 'Amount paid so far';
COMMENT ON COLUMN invoices.balance_amount IS 'Remaining balance (generated)';
COMMENT ON COLUMN invoices.payment_status IS 'Current payment status';
COMMENT ON COLUMN invoices.payment_method IS 'Payment method used';
COMMENT ON COLUMN invoices.payment_date IS 'Date of payment';
COMMENT ON COLUMN invoices.payment_transaction_id IS 'Transaction reference';
COMMENT ON COLUMN invoices.payment_gateway IS 'Payment gateway used';
COMMENT ON COLUMN invoices.payment_notes IS 'Payment notes';
COMMENT ON COLUMN invoices.payment_history IS 'Payment history in JSON';
COMMENT ON COLUMN invoices.insurance_id IS 'Insurance provider';
COMMENT ON COLUMN invoices.insurance_claim_number IS 'Insurance claim number';
COMMENT ON COLUMN invoices.insurance_coverage IS 'Insurance coverage percentage';
COMMENT ON COLUMN invoices.insurance_amount IS 'Amount covered by insurance';
COMMENT ON COLUMN invoices.insurance_approved IS 'Whether insurance approved';
COMMENT ON COLUMN invoices.insurance_approved_by IS 'User who approved insurance';
COMMENT ON COLUMN invoices.insurance_approved_at IS 'Insurance approval timestamp';
COMMENT ON COLUMN invoices.insurance_claim_status IS 'Insurance claim status';
COMMENT ON COLUMN invoices.insurance_notes IS 'Insurance notes';
COMMENT ON COLUMN invoices.items IS 'Invoice line items in JSON';
COMMENT ON COLUMN invoices.item_count IS 'Number of items';
COMMENT ON COLUMN invoices.total_quantity IS 'Total quantity of items';
COMMENT ON COLUMN invoices.invoice_pdf_url IS 'PDF invoice URL';
COMMENT ON COLUMN invoices.invoice_html_url IS 'HTML invoice URL';
COMMENT ON COLUMN invoices.receipt_url IS 'Receipt URL';
COMMENT ON COLUMN invoices.supporting_documents IS 'Supporting documents in JSON';
COMMENT ON COLUMN invoices.refund_amount IS 'Amount refunded';
COMMENT ON COLUMN invoices.refund_date IS 'Refund date';
COMMENT ON COLUMN invoices.refund_reason IS 'Reason for refund';
COMMENT ON COLUMN invoices.refund_approved_by IS 'User who approved refund';
COMMENT ON COLUMN invoices.refund_approved_at IS 'Refund approval timestamp';
COMMENT ON COLUMN invoices.refund_transaction_id IS 'Refund transaction reference';
COMMENT ON COLUMN invoices.refund_history IS 'Refund history in JSON';
COMMENT ON COLUMN invoices.status IS 'Invoice status';
COMMENT ON COLUMN invoices.approval_level IS 'Approval level required';
COMMENT ON COLUMN invoices.submitted_by IS 'User who submitted';
COMMENT ON COLUMN invoices.submitted_at IS 'Submission timestamp';
COMMENT ON COLUMN invoices.approved_by IS 'User who approved';
COMMENT ON COLUMN invoices.approved_at IS 'Approval timestamp';
COMMENT ON COLUMN invoices.rejected_by IS 'User who rejected';
COMMENT ON COLUMN invoices.rejected_at IS 'Rejection timestamp';
COMMENT ON COLUMN invoices.rejection_reason IS 'Rejection reason';
COMMENT ON COLUMN invoices.cancelled_by IS 'User who cancelled';
COMMENT ON COLUMN invoices.cancelled_at IS 'Cancellation timestamp';
COMMENT ON COLUMN invoices.cancellation_reason IS 'Cancellation reason';
COMMENT ON COLUMN invoices.email_sent IS 'Whether email was sent';
COMMENT ON COLUMN invoices.email_sent_at IS 'Email sent timestamp';
COMMENT ON COLUMN invoices.sms_sent IS 'Whether SMS was sent';
COMMENT ON COLUMN invoices.sms_sent_at IS 'SMS sent timestamp';
COMMENT ON COLUMN invoices.whatsapp_sent IS 'Whether WhatsApp was sent';
COMMENT ON COLUMN invoices.whatsapp_sent_at IS 'WhatsApp sent timestamp';
COMMENT ON COLUMN invoices.notes IS 'General notes';
COMMENT ON COLUMN invoices.terms_conditions IS 'Terms and conditions';
COMMENT ON COLUMN invoices.footer_text IS 'Footer text';
COMMENT ON COLUMN invoices.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN invoices.is_deleted IS 'Soft delete flag';

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
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'invoices';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'invoices';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'invoices'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'invoices'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'invoices';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('invoice_status_enum', 'payment_status_enum', 'payment_method_enum', 'invoice_type_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 011_create_invoices.sql COMPLETED';
    RAISE NOTICE 'Invoices table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
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