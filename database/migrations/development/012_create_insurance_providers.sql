-- ============================================
-- MIGRATION: 012_create_insurance_providers.sql
-- DESCRIPTION: Create insurance providers table with complete insurance management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create insurance_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_type_enum') THEN
        CREATE TYPE insurance_type_enum AS ENUM (
            'private',
            'government',
            'employer',
            'travel',
            'life',
            'health'
        );
        RAISE NOTICE 'Created insurance_type_enum type';
    END IF;
END $$;

-- Create provider_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_status_enum') THEN
        CREATE TYPE provider_status_enum AS ENUM (
            'active',
            'inactive',
            'blacklisted',
            'pending_verification',
            'suspended'
        );
        RAISE NOTICE 'Created provider_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE INSURANCE PROVIDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS insurance_providers (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    
    -- ========================================
    -- COMPANY DETAILS
    -- ========================================
    type insurance_type_enum DEFAULT 'private',
    website VARCHAR(255),
    logo_url TEXT,
    established_date DATE,
    registration_number VARCHAR(100) UNIQUE,
    license_number VARCHAR(100),
    tax_id VARCHAR(50),
    
    -- ========================================
    -- CONTACT INFORMATION
    -- ========================================
    contact_person VARCHAR(200),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(255),
    alternate_email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    
    -- ========================================
    -- COVERAGE DETAILS
    -- ========================================
    coverage_percentage DECIMAL(5,2) DEFAULT 70.00,
    coverage_details JSONB,
    coverage_limits JSONB,
    exclusions TEXT,
    pre_approval_required BOOLEAN DEFAULT FALSE,
    pre_approval_days INTEGER DEFAULT 7,
    claim_deadline_days INTEGER DEFAULT 30,
    max_claim_amount DECIMAL(12,2),
    annual_maximum DECIMAL(12,2),
    lifetime_maximum DECIMAL(12,2),
    deductible_amount DECIMAL(10,2) DEFAULT 0,
    copay_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- ========================================
    -- NETWORK DETAILS
    -- ========================================
    network_type VARCHAR(50),
    network_providers JSONB,
    cashless_hospitals JSONB,
    is_cashless BOOLEAN DEFAULT TRUE,
    is_reimbursement BOOLEAN DEFAULT TRUE,
    
    -- ========================================
    -- POLICY DETAILS
    -- ========================================
    policy_types JSONB,
    min_age INTEGER DEFAULT 0,
    max_age INTEGER DEFAULT 100,
    pre_existing_wait INTEGER DEFAULT 24,
    maternity_coverage BOOLEAN DEFAULT FALSE,
    maternity_wait INTEGER DEFAULT 24,
    daycare_procedures BOOLEAN DEFAULT TRUE,
    
    -- ========================================
    -- CONTACT & SUPPORT
    -- ========================================
    support_phone VARCHAR(20),
    support_email VARCHAR(255),
    emergency_phone VARCHAR(20),
    claims_phone VARCHAR(20),
    claims_email VARCHAR(255),
    portal_url VARCHAR(255),
    api_endpoint VARCHAR(255),
    api_key_required BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- AGREEMENT DETAILS
    -- ========================================
    agreement_start_date DATE,
    agreement_end_date DATE,
    agreement_document_url TEXT,
    terms_conditions_url TEXT,
    commission_percentage DECIMAL(5,2) DEFAULT 0,
    commission_structure JSONB,
    
    -- ========================================
    -- STATUS
    -- ========================================
    status provider_status_enum DEFAULT 'active',
    is_preferred BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP,
    blacklist_reason TEXT,
    notes TEXT,
    
    -- ========================================
    -- PERFORMANCE METRICS
    -- ========================================
    avg_claim_settlement_days INTEGER,
    claim_settlement_ratio DECIMAL(5,2),
    customer_rating DECIMAL(3,2),
    total_policies INTEGER DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    total_settled_amount DECIMAL(14,2) DEFAULT 0,
    
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
    CONSTRAINT fk_insurance_providers_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_providers_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_providers_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_providers_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_coverage CHECK (coverage_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_copay CHECK (copay_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_commission CHECK (commission_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_ages CHECK (min_age >= 0 AND max_age >= min_age),
    CONSTRAINT check_dates CHECK (agreement_end_date >= agreement_start_date),
    CONSTRAINT check_amounts CHECK (max_claim_amount >= 0),
    CONSTRAINT check_claim_ratio CHECK (claim_settlement_ratio BETWEEN 0 AND 100),
    CONSTRAINT check_rating CHECK (customer_rating BETWEEN 0 AND 5),
    CONSTRAINT check_pre_approval_days CHECK (pre_approval_days >= 0),
    CONSTRAINT check_claim_deadline CHECK (claim_deadline_days >= 0),
    CONSTRAINT check_waiting_periods CHECK (pre_existing_wait >= 0 AND maternity_wait >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_name ON insurance_providers(name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_code ON insurance_providers(code) WHERE is_deleted = FALSE;

-- Company details indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_type ON insurance_providers(type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_registration ON insurance_providers(registration_number) WHERE registration_number IS NOT NULL AND is_deleted = FALSE;

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_phone ON insurance_providers(phone) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_email ON insurance_providers(email) WHERE email IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_city ON insurance_providers(city) WHERE city IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_state ON insurance_providers(state) WHERE state IS NOT NULL AND is_deleted = FALSE;

-- Coverage indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_coverage ON insurance_providers(coverage_percentage) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_cashless ON insurance_providers(is_cashless) WHERE is_cashless = TRUE AND is_deleted = FALSE;

-- Policy indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_age_range ON insurance_providers(min_age, max_age) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_maternity ON insurance_providers(maternity_coverage) WHERE maternity_coverage = TRUE AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_status ON insurance_providers(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_preferred ON insurance_providers(is_preferred) WHERE is_preferred = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_verified ON insurance_providers(is_verified) WHERE is_verified = TRUE AND is_deleted = FALSE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_rating ON insurance_providers(customer_rating) WHERE customer_rating IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_settlement_days ON insurance_providers(avg_claim_settlement_days) WHERE avg_claim_settlement_days IS NOT NULL AND is_deleted = FALSE;

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_created_at ON insurance_providers(created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_insurance_providers_verified_by ON insurance_providers(verified_by) WHERE verified_by IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_insurance_providers_deleted ON insurance_providers(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_insurance_providers_coverage_details ON insurance_providers USING gin(coverage_details);
CREATE INDEX IF NOT EXISTS idx_insurance_providers_coverage_limits ON insurance_providers USING gin(coverage_limits);
CREATE INDEX IF NOT EXISTS idx_insurance_providers_network_providers ON insurance_providers USING gin(network_providers);
CREATE INDEX IF NOT EXISTS idx_insurance_providers_cashless_hospitals ON insurance_providers USING gin(cashless_hospitals);
CREATE INDEX IF NOT EXISTS idx_insurance_providers_policy_types ON insurance_providers USING gin(policy_types);
CREATE INDEX IF NOT EXISTS idx_insurance_providers_commission_structure ON insurance_providers USING gin(commission_structure);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_insurance_providers_updated_at') THEN
        CREATE TRIGGER update_insurance_providers_updated_at
            BEFORE UPDATE ON insurance_providers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_insurance_providers_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE insurance_providers IS 'Complete insurance providers management system';
COMMENT ON COLUMN insurance_providers.id IS 'Primary key - UUID';
COMMENT ON COLUMN insurance_providers.name IS 'Insurance company name';
COMMENT ON COLUMN insurance_providers.code IS 'Unique provider code';
COMMENT ON COLUMN insurance_providers.type IS 'Type of insurance provider';
COMMENT ON COLUMN insurance_providers.website IS 'Company website';
COMMENT ON COLUMN insurance_providers.logo_url IS 'Company logo URL';
COMMENT ON COLUMN insurance_providers.established_date IS 'Date company was established';
COMMENT ON COLUMN insurance_providers.registration_number IS 'Company registration number';
COMMENT ON COLUMN insurance_providers.license_number IS 'Insurance license number';
COMMENT ON COLUMN insurance_providers.tax_id IS 'Tax identification number';
COMMENT ON COLUMN insurance_providers.contact_person IS 'Primary contact person';
COMMENT ON COLUMN insurance_providers.phone IS 'Primary phone number';
COMMENT ON COLUMN insurance_providers.alternate_phone IS 'Alternate phone number';
COMMENT ON COLUMN insurance_providers.email IS 'Primary email address';
COMMENT ON COLUMN insurance_providers.alternate_email IS 'Alternate email address';
COMMENT ON COLUMN insurance_providers.address IS 'Physical address';
COMMENT ON COLUMN insurance_providers.city IS 'City';
COMMENT ON COLUMN insurance_providers.state IS 'State';
COMMENT ON COLUMN insurance_providers.country IS 'Country';
COMMENT ON COLUMN insurance_providers.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN insurance_providers.coverage_percentage IS 'Default coverage percentage';
COMMENT ON COLUMN insurance_providers.coverage_details IS 'Detailed coverage information in JSON';
COMMENT ON COLUMN insurance_providers.coverage_limits IS 'Coverage limits in JSON';
COMMENT ON COLUMN insurance_providers.exclusions IS 'Policy exclusions';
COMMENT ON COLUMN insurance_providers.pre_approval_required IS 'Whether pre-approval is required';
COMMENT ON COLUMN insurance_providers.pre_approval_days IS 'Days needed for pre-approval';
COMMENT ON COLUMN insurance_providers.claim_deadline_days IS 'Days within which claim must be filed';
COMMENT ON COLUMN insurance_providers.max_claim_amount IS 'Maximum claim amount per incident';
COMMENT ON COLUMN insurance_providers.annual_maximum IS 'Annual maximum coverage';
COMMENT ON COLUMN insurance_providers.lifetime_maximum IS 'Lifetime maximum coverage';
COMMENT ON COLUMN insurance_providers.deductible_amount IS 'Deductible amount';
COMMENT ON COLUMN insurance_providers.copay_percentage IS 'Copay percentage';
COMMENT ON COLUMN insurance_providers.network_type IS 'Network type (PPO/HMO/POS)';
COMMENT ON COLUMN insurance_providers.network_providers IS 'List of empaneled providers in JSON';
COMMENT ON COLUMN insurance_providers.cashless_hospitals IS 'List of cashless hospitals in JSON';
COMMENT ON COLUMN insurance_providers.is_cashless IS 'Whether cashless facility is available';
COMMENT ON COLUMN insurance_providers.is_reimbursement IS 'Whether reimbursement is available';
COMMENT ON COLUMN insurance_providers.policy_types IS 'Types of policies offered in JSON';
COMMENT ON COLUMN insurance_providers.min_age IS 'Minimum age for coverage';
COMMENT ON COLUMN insurance_providers.max_age IS 'Maximum age for coverage';
COMMENT ON COLUMN insurance_providers.pre_existing_wait IS 'Waiting period for pre-existing conditions in months';
COMMENT ON COLUMN insurance_providers.maternity_coverage IS 'Whether maternity is covered';
COMMENT ON COLUMN insurance_providers.maternity_wait IS 'Waiting period for maternity coverage in months';
COMMENT ON COLUMN insurance_providers.daycare_procedures IS 'Whether daycare procedures are covered';
COMMENT ON COLUMN insurance_providers.support_phone IS 'Customer support phone';
COMMENT ON COLUMN insurance_providers.support_email IS 'Customer support email';
COMMENT ON COLUMN insurance_providers.emergency_phone IS 'Emergency contact phone';
COMMENT ON COLUMN insurance_providers.claims_phone IS 'Claims department phone';
COMMENT ON COLUMN insurance_providers.claims_email IS 'Claims department email';
COMMENT ON COLUMN insurance_providers.portal_url IS 'Customer portal URL';
COMMENT ON COLUMN insurance_providers.api_endpoint IS 'API endpoint for integration';
COMMENT ON COLUMN insurance_providers.api_key_required IS 'Whether API key is required';
COMMENT ON COLUMN insurance_providers.agreement_start_date IS 'Agreement start date';
COMMENT ON COLUMN insurance_providers.agreement_end_date IS 'Agreement end date';
COMMENT ON COLUMN insurance_providers.agreement_document_url IS 'Agreement document URL';
COMMENT ON COLUMN insurance_providers.terms_conditions_url IS 'Terms and conditions URL';
COMMENT ON COLUMN insurance_providers.commission_percentage IS 'Commission percentage';
COMMENT ON COLUMN insurance_providers.commission_structure IS 'Commission structure in JSON';
COMMENT ON COLUMN insurance_providers.status IS 'Provider status';
COMMENT ON COLUMN insurance_providers.is_preferred IS 'Whether preferred provider';
COMMENT ON COLUMN insurance_providers.is_verified IS 'Whether provider is verified';
COMMENT ON COLUMN insurance_providers.verified_by IS 'User who verified';
COMMENT ON COLUMN insurance_providers.verified_at IS 'Verification timestamp';
COMMENT ON COLUMN insurance_providers.blacklist_reason IS 'Reason if blacklisted';
COMMENT ON COLUMN insurance_providers.notes IS 'General notes';
COMMENT ON COLUMN insurance_providers.avg_claim_settlement_days IS 'Average days to settle claims';
COMMENT ON COLUMN insurance_providers.claim_settlement_ratio IS 'Claim settlement ratio percentage';
COMMENT ON COLUMN insurance_providers.customer_rating IS 'Customer rating (1-5)';
COMMENT ON COLUMN insurance_providers.total_policies IS 'Total number of policies';
COMMENT ON COLUMN insurance_providers.total_claims IS 'Total number of claims';
COMMENT ON COLUMN insurance_providers.total_settled_amount IS 'Total amount settled';
COMMENT ON COLUMN insurance_providers.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_providers') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'insurance_providers';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'insurance_providers';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'insurance_providers'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'insurance_providers'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'insurance_providers';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('insurance_type_enum', 'provider_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 012_create_insurance_providers.sql COMPLETED';
    RAISE NOTICE 'Insurance Providers table exists: %', table_exists;
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