-- ============================================
-- MIGRATION: 008_create_suppliers.sql
-- DESCRIPTION: Create suppliers table with complete vendor management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create supplier_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_status_enum') THEN
        CREATE TYPE supplier_status_enum AS ENUM (
            'active',
            'inactive',
            'blacklisted',
            'on_hold'
        );
        RAISE NOTICE 'Created supplier_status_enum type';
    END IF;
END $$;

-- Create supplier_approval enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_approval_enum') THEN
        CREATE TYPE supplier_approval_enum AS ENUM (
            'pending',
            'approved',
            'rejected',
            'under_review'
        );
        RAISE NOTICE 'Created supplier_approval_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE SUPPLIERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    
    -- ========================================
    -- CONTACT INFORMATION
    -- ========================================
    contact_person VARCHAR(200),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    
    -- ========================================
    -- ADDRESS
    -- ========================================
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    
    -- ========================================
    -- BUSINESS DETAILS
    -- ========================================
    gst_number VARCHAR(50) UNIQUE,
    pan_number VARCHAR(20),
    license_number VARCHAR(100),
    business_type VARCHAR(100),
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(10,2) DEFAULT 0,
    credit_days INTEGER DEFAULT 30,
    minimum_order DECIMAL(10,2) DEFAULT 0,
    
    -- ========================================
    -- BANKING DETAILS
    -- ========================================
    bank_name VARCHAR(200),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    bank_swift_code VARCHAR(20),
    bank_branch VARCHAR(200),
    
    -- ========================================
    -- DOCUMENTS
    -- ========================================
    gst_certificate_url TEXT,
    pan_card_url TEXT,
    license_document_url TEXT,
    agreement_url TEXT,
    other_documents JSONB,
    
    -- ========================================
    -- PERFORMANCE METRICS
    -- ========================================
    delivery_time_avg INTEGER,
    quality_rating DECIMAL(3,2),
    price_competitiveness DECIMAL(3,2),
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    last_order_date TIMESTAMP,
    last_payment_date TIMESTAMP,
    
    -- ========================================
    -- STATUS
    -- ========================================
    status supplier_status_enum DEFAULT 'active',
    approval_status supplier_approval_enum DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    blacklist_reason TEXT,
    hold_reason TEXT,
    
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
    -- NOTES & METADATA
    -- ========================================
    notes TEXT,
    metadata JSONB,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_suppliers_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_suppliers_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_suppliers_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_gst_format CHECK (
        gst_number IS NULL OR 
        gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    ),
    CONSTRAINT check_pan_format CHECK (
        pan_number IS NULL OR 
        pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    ),
    CONSTRAINT check_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT check_credit_days CHECK (credit_days >= 0),
    CONSTRAINT check_minimum_order CHECK (minimum_order >= 0),
    CONSTRAINT check_quality_rating CHECK (
        quality_rating IS NULL OR 
        (quality_rating >= 0 AND quality_rating <= 5)
    ),
    CONSTRAINT check_price_rating CHECK (
        price_competitiveness IS NULL OR 
        (price_competitiveness >= 0 AND price_competitiveness <= 5)
    ),
    CONSTRAINT check_delivery_time CHECK (delivery_time_avg >= 0),
    CONSTRAINT check_total_orders CHECK (total_orders >= 0),
    CONSTRAINT check_total_spent CHECK (total_spent >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core search indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code) WHERE is_deleted = FALSE;

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL AND is_deleted = FALSE;

-- Business indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_gst ON suppliers(gst_number) WHERE gst_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_pan ON suppliers(pan_number) WHERE pan_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_license ON suppliers(license_number) WHERE license_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_business_type ON suppliers(business_type) WHERE business_type IS NOT NULL AND is_deleted = FALSE;

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city) WHERE city IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_state ON suppliers(state) WHERE state IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON suppliers(country) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_approval ON suppliers(approval_status) WHERE is_deleted = FALSE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(quality_rating) WHERE quality_rating IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_orders ON suppliers(total_orders) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_last_order ON suppliers(last_order_date) WHERE last_order_date IS NOT NULL AND is_deleted = FALSE;

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_suppliers_approved_by ON suppliers(approved_by) WHERE approved_by IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted ON suppliers(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_metadata ON suppliers USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_suppliers_other_docs ON suppliers USING gin(other_documents);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_suppliers_updated_at') THEN
        CREATE TRIGGER update_suppliers_updated_at
            BEFORE UPDATE ON suppliers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_suppliers_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE suppliers IS 'Complete suppliers/vendors management';
COMMENT ON COLUMN suppliers.id IS 'Primary key - UUID';
COMMENT ON COLUMN suppliers.name IS 'Supplier company name';
COMMENT ON COLUMN suppliers.code IS 'Unique supplier code';
COMMENT ON COLUMN suppliers.contact_person IS 'Primary contact person';
COMMENT ON COLUMN suppliers.phone IS 'Primary contact number';
COMMENT ON COLUMN suppliers.alternate_phone IS 'Alternate contact number';
COMMENT ON COLUMN suppliers.email IS 'Email address';
COMMENT ON COLUMN suppliers.website IS 'Company website';
COMMENT ON COLUMN suppliers.address IS 'Physical address';
COMMENT ON COLUMN suppliers.city IS 'City';
COMMENT ON COLUMN suppliers.state IS 'State';
COMMENT ON COLUMN suppliers.country IS 'Country';
COMMENT ON COLUMN suppliers.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN suppliers.gst_number IS 'GST/PAN/Tax ID';
COMMENT ON COLUMN suppliers.pan_number IS 'PAN card number';
COMMENT ON COLUMN suppliers.license_number IS 'Drug license number';
COMMENT ON COLUMN suppliers.business_type IS 'Type of business';
COMMENT ON COLUMN suppliers.payment_terms IS 'Payment terms (Net 30, etc.)';
COMMENT ON COLUMN suppliers.credit_limit IS 'Maximum credit limit';
COMMENT ON COLUMN suppliers.credit_days IS 'Credit period in days';
COMMENT ON COLUMN suppliers.minimum_order IS 'Minimum order value';
COMMENT ON COLUMN suppliers.bank_name IS 'Bank name';
COMMENT ON COLUMN suppliers.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN suppliers.bank_ifsc_code IS 'Bank IFSC code';
COMMENT ON COLUMN suppliers.bank_swift_code IS 'Bank SWIFT code';
COMMENT ON COLUMN suppliers.bank_branch IS 'Bank branch';
COMMENT ON COLUMN suppliers.gst_certificate_url IS 'GST certificate URL';
COMMENT ON COLUMN suppliers.pan_card_url IS 'PAN card URL';
COMMENT ON COLUMN suppliers.license_document_url IS 'License document URL';
COMMENT ON COLUMN suppliers.agreement_url IS 'Agreement/contract URL';
COMMENT ON COLUMN suppliers.other_documents IS 'Other documents in JSON';
COMMENT ON COLUMN suppliers.delivery_time_avg IS 'Average delivery time in days';
COMMENT ON COLUMN suppliers.quality_rating IS 'Quality rating (1-5)';
COMMENT ON COLUMN suppliers.price_competitiveness IS 'Price rating (1-5)';
COMMENT ON COLUMN suppliers.total_orders IS 'Total orders placed';
COMMENT ON COLUMN suppliers.total_spent IS 'Total amount spent';
COMMENT ON COLUMN suppliers.last_order_date IS 'Last order date';
COMMENT ON COLUMN suppliers.last_payment_date IS 'Last payment date';
COMMENT ON COLUMN suppliers.status IS 'Supplier status';
COMMENT ON COLUMN suppliers.approval_status IS 'Approval status';
COMMENT ON COLUMN suppliers.approved_by IS 'User who approved';
COMMENT ON COLUMN suppliers.approved_at IS 'Approval timestamp';
COMMENT ON COLUMN suppliers.blacklist_reason IS 'Reason for blacklisting';
COMMENT ON COLUMN suppliers.hold_reason IS 'Reason for on-hold status';
COMMENT ON COLUMN suppliers.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN suppliers.notes IS 'Additional notes';
COMMENT ON COLUMN suppliers.metadata IS 'Additional flexible data in JSON';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'suppliers';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'suppliers';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'suppliers'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'suppliers'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'suppliers';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('supplier_status_enum', 'supplier_approval_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 008_create_suppliers.sql COMPLETED';
    RAISE NOTICE 'Suppliers table exists: %', table_exists;
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