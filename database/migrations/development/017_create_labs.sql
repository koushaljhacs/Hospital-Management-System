-- ============================================
-- MIGRATION: 017_create_labs.sql
-- DESCRIPTION: Create labs table for laboratory management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: departments table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create lab_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lab_type_enum') THEN
        CREATE TYPE lab_type_enum AS ENUM (
            'in_house',
            'reference',
            'external',
            'partner',
            'mobile'
        );
        RAISE NOTICE 'Created lab_type_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE LABS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS labs (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_code VARCHAR(50) UNIQUE NOT NULL,
    lab_name VARCHAR(200) NOT NULL,
    lab_type lab_type_enum NOT NULL,
    
    -- ========================================
    -- CONTACT INFORMATION
    -- ========================================
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    
    -- ========================================
    -- CONTACT PERSON
    -- ========================================
    contact_person VARCHAR(200),
    contact_person_phone VARCHAR(20),
    contact_person_email VARCHAR(255),
    contact_person_designation VARCHAR(100),
    
    -- ========================================
    -- REGISTRATION DETAILS
    -- ========================================
    registration_number VARCHAR(100) UNIQUE,
    license_number VARCHAR(100),
    accreditation VARCHAR(100),
    established_date DATE,
    nabl_accredited BOOLEAN DEFAULT FALSE,
    nabl_certificate_url TEXT,
    
    -- ========================================
    -- LOCATION & FACILITIES
    -- ========================================
    department_id UUID,
    floor INTEGER,
    building VARCHAR(100),
    has_emergency_service BOOLEAN DEFAULT FALSE,
    has_home_collection BOOLEAN DEFAULT FALSE,
    operating_hours JSONB,
    holiday_list JSONB,
    
    -- ========================================
    -- SERVICES
    -- ========================================
    services_offered JSONB,
    test_categories JSONB,
    equipment_list JSONB,
    total_technicians INTEGER DEFAULT 0,
    
    -- ========================================
    -- ACCREDITATIONS & CERTIFICATIONS
    -- ========================================
    accreditations JSONB,
    certifications JSONB,
    certificates_url TEXT[],
    
    -- ========================================
    -- CONTRACTS & AGREEMENTS
    -- ========================================
    contract_start_date DATE,
    contract_end_date DATE,
    contract_document_url TEXT,
    agreement_terms TEXT,
    commission_percentage DECIMAL(5,2) DEFAULT 0,
    payment_terms VARCHAR(100),
    
    -- ========================================
    -- PERFORMANCE METRICS
    -- ========================================
    avg_turnaround_time INTEGER,
    total_tests_per_day INTEGER,
    max_tests_per_day INTEGER,
    quality_rating DECIMAL(3,2),
    customer_rating DECIMAL(3,2),
    
    -- ========================================
    -- STATUS
    -- ========================================
    is_active BOOLEAN DEFAULT TRUE,
    is_preferred BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP,
    blacklist_reason TEXT,
    
    -- ========================================
    -- NOTES
    -- ========================================
    notes TEXT,
    internal_notes TEXT,
    metadata JSONB,
    
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
    CONSTRAINT fk_labs_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_labs_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_labs_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_labs_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_labs_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (contract_end_date >= contract_start_date),
    CONSTRAINT check_phone CHECK (phone ~ '^[0-9+\-\s]{10,20}$'),
    CONSTRAINT check_commission CHECK (commission_percentage BETWEEN 0 AND 100),
    CONSTRAINT check_quality_rating CHECK (quality_rating BETWEEN 0 AND 5),
    CONSTRAINT check_customer_rating CHECK (customer_rating BETWEEN 0 AND 5),
    CONSTRAINT check_turnaround CHECK (avg_turnaround_time >= 0),
    CONSTRAINT check_tests_per_day CHECK (total_tests_per_day >= 0 AND max_tests_per_day >= total_tests_per_day),
    CONSTRAINT check_technicians CHECK (total_technicians >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_labs_code ON labs(lab_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_name ON labs(lab_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_type ON labs(lab_type) WHERE is_deleted = FALSE;

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_labs_phone ON labs(phone) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_email ON labs(email) WHERE email IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_city ON labs(city) WHERE city IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_state ON labs(state) WHERE state IS NOT NULL AND is_deleted = FALSE;

-- Registration indexes
CREATE INDEX IF NOT EXISTS idx_labs_registration ON labs(registration_number) WHERE registration_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_license ON labs(license_number) WHERE license_number IS NOT NULL AND is_deleted = FALSE;

-- Department index
CREATE INDEX IF NOT EXISTS idx_labs_department ON labs(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_labs_active ON labs(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_preferred ON labs(is_preferred) WHERE is_preferred = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_verified ON labs(is_verified) WHERE is_verified = TRUE AND is_deleted = FALSE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_labs_quality ON labs(quality_rating) WHERE quality_rating IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labs_turnaround ON labs(avg_turnaround_time) WHERE avg_turnaround_time IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_labs_deleted ON labs(is_deleted, deleted_at);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_labs_operating_hours ON labs USING gin(operating_hours);
CREATE INDEX IF NOT EXISTS idx_labs_holiday_list ON labs USING gin(holiday_list);
CREATE INDEX IF NOT EXISTS idx_labs_services ON labs USING gin(services_offered);
CREATE INDEX IF NOT EXISTS idx_labs_test_categories ON labs USING gin(test_categories);
CREATE INDEX IF NOT EXISTS idx_labs_equipment ON labs USING gin(equipment_list);
CREATE INDEX IF NOT EXISTS idx_labs_accreditations ON labs USING gin(accreditations);
CREATE INDEX IF NOT EXISTS idx_labs_certifications ON labs USING gin(certifications);
CREATE INDEX IF NOT EXISTS idx_labs_metadata ON labs USING gin(metadata);

-- GIN indexes for arrays
CREATE INDEX IF NOT EXISTS idx_labs_certificates_url ON labs USING gin(certificates_url);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_labs_updated_at') THEN
        CREATE TRIGGER update_labs_updated_at
            BEFORE UPDATE ON labs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_labs_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE labs IS 'Complete laboratory management system';
COMMENT ON COLUMN labs.id IS 'Primary key - UUID';
COMMENT ON COLUMN labs.lab_code IS 'Unique lab code';
COMMENT ON COLUMN labs.lab_name IS 'Lab name';
COMMENT ON COLUMN labs.lab_type IS 'Type of lab';
COMMENT ON COLUMN labs.address IS 'Physical address';
COMMENT ON COLUMN labs.city IS 'City';
COMMENT ON COLUMN labs.state IS 'State';
COMMENT ON COLUMN labs.country IS 'Country';
COMMENT ON COLUMN labs.postal_code IS 'Postal code';
COMMENT ON COLUMN labs.phone IS 'Primary phone number';
COMMENT ON COLUMN labs.alternate_phone IS 'Alternate phone number';
COMMENT ON COLUMN labs.email IS 'Email address';
COMMENT ON COLUMN labs.website IS 'Website URL';
COMMENT ON COLUMN labs.contact_person IS 'Primary contact person';
COMMENT ON COLUMN labs.contact_person_phone IS 'Contact person phone';
COMMENT ON COLUMN labs.contact_person_email IS 'Contact person email';
COMMENT ON COLUMN labs.contact_person_designation IS 'Contact person designation';
COMMENT ON COLUMN labs.registration_number IS 'Registration number';
COMMENT ON COLUMN labs.license_number IS 'License number';
COMMENT ON COLUMN labs.accreditation IS 'Accreditation details';
COMMENT ON COLUMN labs.established_date IS 'Date established';
COMMENT ON COLUMN labs.nabl_accredited IS 'Whether NABL accredited';
COMMENT ON COLUMN labs.nabl_certificate_url IS 'NABL certificate URL';
COMMENT ON COLUMN labs.department_id IS 'Department reference';
COMMENT ON COLUMN labs.floor IS 'Floor number';
COMMENT ON COLUMN labs.building IS 'Building name';
COMMENT ON COLUMN labs.has_emergency_service IS 'Whether emergency service available';
COMMENT ON COLUMN labs.has_home_collection IS 'Whether home collection available';
COMMENT ON COLUMN labs.operating_hours IS 'Operating hours in JSON';
COMMENT ON COLUMN labs.holiday_list IS 'Holiday list in JSON';
COMMENT ON COLUMN labs.services_offered IS 'Services offered in JSON';
COMMENT ON COLUMN labs.test_categories IS 'Test categories in JSON';
COMMENT ON COLUMN labs.equipment_list IS 'Equipment list in JSON';
COMMENT ON COLUMN labs.total_technicians IS 'Total number of technicians';
COMMENT ON COLUMN labs.accreditations IS 'Accreditations in JSON';
COMMENT ON COLUMN labs.certifications IS 'Certifications in JSON';
COMMENT ON COLUMN labs.certificates_url IS 'Certificate URLs';
COMMENT ON COLUMN labs.contract_start_date IS 'Contract start date';
COMMENT ON COLUMN labs.contract_end_date IS 'Contract end date';
COMMENT ON COLUMN labs.contract_document_url IS 'Contract document URL';
COMMENT ON COLUMN labs.agreement_terms IS 'Agreement terms';
COMMENT ON COLUMN labs.commission_percentage IS 'Commission percentage';
COMMENT ON COLUMN labs.payment_terms IS 'Payment terms';
COMMENT ON COLUMN labs.avg_turnaround_time IS 'Average turnaround time in hours';
COMMENT ON COLUMN labs.total_tests_per_day IS 'Total tests per day';
COMMENT ON COLUMN labs.max_tests_per_day IS 'Maximum tests per day';
COMMENT ON COLUMN labs.quality_rating IS 'Quality rating (1-5)';
COMMENT ON COLUMN labs.customer_rating IS 'Customer rating (1-5)';
COMMENT ON COLUMN labs.is_active IS 'Whether lab is active';
COMMENT ON COLUMN labs.is_preferred IS 'Whether preferred lab';
COMMENT ON COLUMN labs.is_verified IS 'Whether lab is verified';
COMMENT ON COLUMN labs.verified_by IS 'User who verified';
COMMENT ON COLUMN labs.verified_at IS 'Verification timestamp';
COMMENT ON COLUMN labs.blacklist_reason IS 'Blacklist reason';
COMMENT ON COLUMN labs.notes IS 'General notes';
COMMENT ON COLUMN labs.internal_notes IS 'Internal notes';
COMMENT ON COLUMN labs.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN labs.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'labs') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'labs';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'labs';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'labs'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'labs'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'labs';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname = 'lab_type_enum';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 017_create_labs.sql COMPLETED';
    RAISE NOTICE 'Labs table exists: %', table_exists;
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