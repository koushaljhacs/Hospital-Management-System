-- ============================================
-- MIGRATION: 013_create_lab_tests.sql
-- DESCRIPTION: Create lab tests table with complete test management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: departments table, equipment table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create lab_category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lab_category_enum') THEN
        CREATE TYPE lab_category_enum AS ENUM (
            'hematology',
            'biochemistry',
            'microbiology',
            'pathology',
            'immunology',
            'serology',
            'toxicology',
            'genetics',
            'molecular',
            'urinalysis',
            'stool_analysis',
            'hormones',
            'tumor_markers',
            'cardiac_markers',
            'infectious_diseases',
            'drug_monitoring',
            'allergy_testing',
            'prenatal_screening',
            'newborn_screening',
            'other'
        );
        RAISE NOTICE 'Created lab_category_enum type';
    END IF;
END $$;

-- Create sample_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_type_enum') THEN
        CREATE TYPE sample_type_enum AS ENUM (
            'blood',
            'serum',
            'plasma',
            'urine',
            'stool',
            'sputum',
            'csf',
            'tissue',
            'swab',
            'aspirate',
            'fluid',
            'hair',
            'nail',
            'saliva',
            'semen',
            'amniotic_fluid',
            'bone_marrow',
            'other'
        );
        RAISE NOTICE 'Created sample_type_enum type';
    END IF;
END $$;

-- Create gender enum (if not exists from employees table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
        CREATE TYPE gender_enum AS ENUM (
            'male',
            'female',
            'other',
            'all'
        );
        RAISE NOTICE 'Created gender_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE LAB TESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS lab_tests (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_code VARCHAR(50) UNIQUE NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    category lab_category_enum NOT NULL,
    department_id UUID,
    
    -- ========================================
    -- TEST DETAILS
    -- ========================================
    description TEXT,
    methodology VARCHAR(200),
    sample_type sample_type_enum NOT NULL,
    sample_volume VARCHAR(50),
    sample_container VARCHAR(100),
    storage_conditions TEXT,
    transport_conditions TEXT,
    turnaround_time_hours INTEGER,
    fasting_required BOOLEAN DEFAULT FALSE,
    fasting_hours INTEGER,
    special_preparation TEXT,
    
    -- ========================================
    -- REFERENCE RANGES
    -- ========================================
    normal_range TEXT,
    normal_range_low DECIMAL(10,2),
    normal_range_high DECIMAL(10,2),
    critical_low_value DECIMAL(10,2),
    critical_high_value DECIMAL(10,2),
    panic_low_value DECIMAL(10,2),
    panic_high_value DECIMAL(10,2),
    unit VARCHAR(20),
    unit_description TEXT,
    gender_specific BOOLEAN DEFAULT FALSE,
    applicable_gender gender_enum,
    age_low_limit INTEGER,
    age_high_limit INTEGER,
    
    -- ========================================
    -- REFERENCE RANGES BY AGE/GENDER
    -- ========================================
    reference_ranges_by_age JSONB,
    reference_ranges_by_gender JSONB,
    reference_ranges_by_age_gender JSONB,
    
    -- ========================================
    -- PRICING
    -- ========================================
    price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2),
    insurance_coverage BOOLEAN DEFAULT TRUE,
    cgst_percentage DECIMAL(5,2) DEFAULT 0,
    sgst_percentage DECIMAL(5,2) DEFAULT 0,
    igst_percentage DECIMAL(5,2) DEFAULT 0,
    total_tax_percentage DECIMAL(5,2) GENERATED ALWAYS AS (cgst_percentage + sgst_percentage + igst_percentage) STORED,
    price_with_tax DECIMAL(10,2) GENERATED ALWAYS AS (price * (1 + (cgst_percentage + sgst_percentage + igst_percentage)/100)) STORED,
    
    -- ========================================
    -- BILLING CODES
    -- ========================================
    hcpcs_code VARCHAR(50),
    cpt_code VARCHAR(50),
    loinc_code VARCHAR(50),
    snomed_code VARCHAR(50),
    internal_code VARCHAR(50),
    
    -- ========================================
    -- INSTRUMENTS & EQUIPMENT
    -- ========================================
    instrument_name VARCHAR(200),
    instrument_id UUID,
    equipment_required JSONB,
    
    -- ========================================
    -- QUALITY CONTROL
    -- ========================================
    qc_required BOOLEAN DEFAULT TRUE,
    qc_frequency VARCHAR(50),
    qc_parameters JSONB,
    calibration_required BOOLEAN DEFAULT FALSE,
    calibration_frequency VARCHAR(50),
    
    -- ========================================
    -- INTERPRETATION
    -- ========================================
    interpretation_guidelines TEXT,
    clinical_significance TEXT,
    differential_diagnosis TEXT,
    reflex_testing_rules JSONB,
    
    -- ========================================
    -- STATUS & AVAILABILITY
    -- ========================================
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    available_days JSONB,
    available_time_start TIME,
    available_time_end TIME,
    max_orders_per_day INTEGER,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_level INTEGER DEFAULT 0,
    
    -- ========================================
    -- DOCUMENTS
    -- ========================================
    instruction_sheet_url TEXT,
    consent_form_url TEXT,
    report_template_url TEXT,
    supporting_documents JSONB,
    
    -- ========================================
    -- TAGS & KEYWORDS
    -- ========================================
    tags TEXT[],
    search_keywords TEXT,
    synonyms TEXT[],
    
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
    CONSTRAINT fk_lab_tests_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_tests_instrument FOREIGN KEY (instrument_id) 
        REFERENCES equipment(id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_tests_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_tests_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_tests_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_fasting CHECK (fasting_hours >= 0),
    CONSTRAINT check_turnaround CHECK (turnaround_time_hours >= 0),
    CONSTRAINT check_price CHECK (price >= 0),
    CONSTRAINT check_discounted_price CHECK (discounted_price <= price),
    CONSTRAINT check_age_range CHECK (age_low_limit <= age_high_limit),
    CONSTRAINT check_normal_range CHECK (normal_range_low <= normal_range_high),
    CONSTRAINT check_critical_range CHECK (critical_low_value <= critical_high_value),
    CONSTRAINT check_panic_range CHECK (panic_low_value <= panic_high_value),
    CONSTRAINT check_max_orders CHECK (max_orders_per_day >= 0),
    CONSTRAINT check_tax_percentage CHECK (cgst_percentage >= 0 AND sgst_percentage >= 0 AND igst_percentage >= 0),
    CONSTRAINT check_approval_level CHECK (approval_level >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_code ON lab_tests(test_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_name ON lab_tests(test_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_department ON lab_tests(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;

-- Sample type indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_sample_type ON lab_tests(sample_type) WHERE is_deleted = FALSE;

-- Reference range indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_normal_range ON lab_tests(normal_range_low, normal_range_high) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_critical ON lab_tests(critical_low_value, critical_high_value) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_gender ON lab_tests(gender_specific, applicable_gender) WHERE gender_specific = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_age ON lab_tests(age_low_limit, age_high_limit) WHERE is_deleted = FALSE;

-- Pricing indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_price ON lab_tests(price) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_price_with_tax ON lab_tests(price_with_tax) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_insurance ON lab_tests(insurance_coverage) WHERE insurance_coverage = TRUE AND is_deleted = FALSE;

-- Billing code indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_hcpcs ON lab_tests(hcpcs_code) WHERE hcpcs_code IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_cpt ON lab_tests(cpt_code) WHERE cpt_code IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc ON lab_tests(loinc_code) WHERE loinc_code IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_internal_code ON lab_tests(internal_code) WHERE internal_code IS NOT NULL AND is_deleted = FALSE;

-- Instrument indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_instrument ON lab_tests(instrument_id) WHERE instrument_id IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_active ON lab_tests(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_available ON lab_tests(is_available) WHERE is_available = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_tests_approval ON lab_tests(requires_approval) WHERE requires_approval = TRUE AND is_deleted = FALSE;

-- Availability indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_available_time ON lab_tests(available_time_start, available_time_end) WHERE is_available = TRUE AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_lab_tests_deleted ON lab_tests(is_deleted, deleted_at);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_lab_tests_ref_ranges_age ON lab_tests USING gin(reference_ranges_by_age);
CREATE INDEX IF NOT EXISTS idx_lab_tests_ref_ranges_gender ON lab_tests USING gin(reference_ranges_by_gender);
CREATE INDEX IF NOT EXISTS idx_lab_tests_ref_ranges_age_gender ON lab_tests USING gin(reference_ranges_by_age_gender);
CREATE INDEX IF NOT EXISTS idx_lab_tests_equipment ON lab_tests USING gin(equipment_required);
CREATE INDEX IF NOT EXISTS idx_lab_tests_qc_params ON lab_tests USING gin(qc_parameters);
CREATE INDEX IF NOT EXISTS idx_lab_tests_reflex_rules ON lab_tests USING gin(reflex_testing_rules);
CREATE INDEX IF NOT EXISTS idx_lab_tests_available_days ON lab_tests USING gin(available_days);
CREATE INDEX IF NOT EXISTS idx_lab_tests_supporting_docs ON lab_tests USING gin(supporting_documents);

-- GIN indexes for arrays
CREATE INDEX IF NOT EXISTS idx_lab_tests_tags ON lab_tests USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_lab_tests_synonyms ON lab_tests USING gin(synonyms);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_lab_tests_search ON lab_tests USING gin(to_tsvector('english', test_name || ' ' || COALESCE(search_keywords, '') || ' ' || COALESCE(description, '')));

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_lab_tests_updated_at') THEN
        CREATE TRIGGER update_lab_tests_updated_at
            BEFORE UPDATE ON lab_tests
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_lab_tests_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE lab_tests IS 'Complete laboratory tests management system';
COMMENT ON COLUMN lab_tests.id IS 'Primary key - UUID';
COMMENT ON COLUMN lab_tests.test_code IS 'Unique test code';
COMMENT ON COLUMN lab_tests.test_name IS 'Full name of the test';
COMMENT ON COLUMN lab_tests.short_name IS 'Short/abbreviated name';
COMMENT ON COLUMN lab_tests.category IS 'Test category';
COMMENT ON COLUMN lab_tests.department_id IS 'Department that performs the test';
COMMENT ON COLUMN lab_tests.description IS 'Detailed description of the test';
COMMENT ON COLUMN lab_tests.methodology IS 'Testing methodology used';
COMMENT ON COLUMN lab_tests.sample_type IS 'Type of sample required';
COMMENT ON COLUMN lab_tests.sample_volume IS 'Volume of sample needed';
COMMENT ON COLUMN lab_tests.sample_container IS 'Container type for sample';
COMMENT ON COLUMN lab_tests.storage_conditions IS 'Sample storage requirements';
COMMENT ON COLUMN lab_tests.transport_conditions IS 'Sample transport requirements';
COMMENT ON COLUMN lab_tests.turnaround_time_hours IS 'Time to get results in hours';
COMMENT ON COLUMN lab_tests.fasting_required IS 'Whether fasting is required';
COMMENT ON COLUMN lab_tests.fasting_hours IS 'Hours of fasting required';
COMMENT ON COLUMN lab_tests.special_preparation IS 'Special preparation instructions';
COMMENT ON COLUMN lab_tests.normal_range IS 'Normal range as text';
COMMENT ON COLUMN lab_tests.normal_range_low IS 'Lower limit of normal range';
COMMENT ON COLUMN lab_tests.normal_range_high IS 'Upper limit of normal range';
COMMENT ON COLUMN lab_tests.critical_low_value IS 'Critical low value';
COMMENT ON COLUMN lab_tests.critical_high_value IS 'Critical high value';
COMMENT ON COLUMN lab_tests.panic_low_value IS 'Panic low value';
COMMENT ON COLUMN lab_tests.panic_high_value IS 'Panic high value';
COMMENT ON COLUMN lab_tests.unit IS 'Unit of measurement';
COMMENT ON COLUMN lab_tests.unit_description IS 'Description of the unit';
COMMENT ON COLUMN lab_tests.gender_specific IS 'Whether range is gender specific';
COMMENT ON COLUMN lab_tests.applicable_gender IS 'Gender for which test applies';
COMMENT ON COLUMN lab_tests.age_low_limit IS 'Lower age limit for test';
COMMENT ON COLUMN lab_tests.age_high_limit IS 'Upper age limit for test';
COMMENT ON COLUMN lab_tests.reference_ranges_by_age IS 'Reference ranges by age in JSON';
COMMENT ON COLUMN lab_tests.reference_ranges_by_gender IS 'Reference ranges by gender in JSON';
COMMENT ON COLUMN lab_tests.reference_ranges_by_age_gender IS 'Reference ranges by age and gender in JSON';
COMMENT ON COLUMN lab_tests.price IS 'Base price of the test';
COMMENT ON COLUMN lab_tests.discounted_price IS 'Discounted price';
COMMENT ON COLUMN lab_tests.insurance_coverage IS 'Whether insurance covers this test';
COMMENT ON COLUMN lab_tests.cgst_percentage IS 'Central GST percentage';
COMMENT ON COLUMN lab_tests.sgst_percentage IS 'State GST percentage';
COMMENT ON COLUMN lab_tests.igst_percentage IS 'Integrated GST percentage';
COMMENT ON COLUMN lab_tests.total_tax_percentage IS 'Total tax percentage (generated)';
COMMENT ON COLUMN lab_tests.price_with_tax IS 'Price including tax (generated)';
COMMENT ON COLUMN lab_tests.hcpcs_code IS 'HCPCS billing code';
COMMENT ON COLUMN lab_tests.cpt_code IS 'CPT billing code';
COMMENT ON COLUMN lab_tests.loinc_code IS 'LOINC code';
COMMENT ON COLUMN lab_tests.snomed_code IS 'SNOMED CT code';
COMMENT ON COLUMN lab_tests.internal_code IS 'Internal billing code';
COMMENT ON COLUMN lab_tests.instrument_name IS 'Name of instrument used';
COMMENT ON COLUMN lab_tests.instrument_id IS 'Reference to equipment';
COMMENT ON COLUMN lab_tests.equipment_required IS 'Required equipment in JSON';
COMMENT ON COLUMN lab_tests.qc_required IS 'Whether quality control is required';
COMMENT ON COLUMN lab_tests.qc_frequency IS 'Quality control frequency';
COMMENT ON COLUMN lab_tests.qc_parameters IS 'Quality control parameters in JSON';
COMMENT ON COLUMN lab_tests.calibration_required IS 'Whether calibration is required';
COMMENT ON COLUMN lab_tests.calibration_frequency IS 'Calibration frequency';
COMMENT ON COLUMN lab_tests.interpretation_guidelines IS 'Guidelines for interpreting results';
COMMENT ON COLUMN lab_tests.clinical_significance IS 'Clinical significance of the test';
COMMENT ON COLUMN lab_tests.differential_diagnosis IS 'Differential diagnosis information';
COMMENT ON COLUMN lab_tests.reflex_testing_rules IS 'Rules for reflex testing in JSON';
COMMENT ON COLUMN lab_tests.is_active IS 'Whether test is active';
COMMENT ON COLUMN lab_tests.is_available IS 'Whether test is currently available';
COMMENT ON COLUMN lab_tests.available_days IS 'Days when test is available in JSON';
COMMENT ON COLUMN lab_tests.available_time_start IS 'Start time of availability';
COMMENT ON COLUMN lab_tests.available_time_end IS 'End time of availability';
COMMENT ON COLUMN lab_tests.max_orders_per_day IS 'Maximum orders per day';
COMMENT ON COLUMN lab_tests.requires_approval IS 'Whether test requires approval';
COMMENT ON COLUMN lab_tests.approval_level IS 'Approval level required';
COMMENT ON COLUMN lab_tests.instruction_sheet_url IS 'URL to instruction sheet';
COMMENT ON COLUMN lab_tests.consent_form_url IS 'URL to consent form';
COMMENT ON COLUMN lab_tests.report_template_url IS 'URL to report template';
COMMENT ON COLUMN lab_tests.supporting_documents IS 'Supporting documents in JSON';
COMMENT ON COLUMN lab_tests.tags IS 'Tags for categorization';
COMMENT ON COLUMN lab_tests.search_keywords IS 'Keywords for search';
COMMENT ON COLUMN lab_tests.synonyms IS 'Synonyms for the test';
COMMENT ON COLUMN lab_tests.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_tests') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'lab_tests';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'lab_tests';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'lab_tests'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'lab_tests'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'lab_tests';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('lab_category_enum', 'sample_type_enum', 'gender_enum');
    
    -- Count generated columns
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'lab_tests' AND is_generated = 'ALWAYS';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 013_create_lab_tests.sql COMPLETED';
    RAISE NOTICE 'Lab Tests table exists: %', table_exists;
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