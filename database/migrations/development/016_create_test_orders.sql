
-- ============================================
-- MIGRATION: 016_create_test_orders.sql (FIXED)
-- DESCRIPTION: Create test orders table for lab test ordering
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: patients table, employees table, departments table, labs table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create test_priority enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_priority_enum') THEN
        CREATE TYPE test_priority_enum AS ENUM (
            'routine',
            'urgent',
            'stat',
            'timed'
        );
        RAISE NOTICE 'Created test_priority_enum type';
    END IF;
END $$;

-- Create test_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_status_enum') THEN
        CREATE TYPE test_status_enum AS ENUM (
            'pending',
            'ordered',
            'collected',
            'received',
            'in_progress',
            'completed',
            'verified',
            'reported',
            'cancelled'
        );
        RAISE NOTICE 'Created test_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE TEST ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS test_orders (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- ========================================
    -- REFERENCES
    -- ========================================
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    department_id UUID,
    lab_id UUID,
    
    -- ========================================
    -- ORDER DETAILS
    -- ========================================
    order_date DATE NOT NULL,
    order_time TIME,
    priority test_priority_enum DEFAULT 'routine',
    clinical_notes TEXT,
    diagnosis TEXT,
    special_instructions TEXT,
    
    -- ========================================
    -- TEST ITEMS
    -- ========================================
    test_items JSONB NOT NULL,
    total_tests INTEGER DEFAULT 0,
    
    -- ========================================
    -- STATUS
    -- ========================================
    status test_status_enum DEFAULT 'pending',
    is_urgent BOOLEAN DEFAULT FALSE,
    is_stat BOOLEAN DEFAULT FALSE,
    is_outside_lab BOOLEAN DEFAULT FALSE,
    outside_lab_name VARCHAR(200),
    
    -- ========================================
    -- COLLECTION DETAILS
    -- ========================================
    collection_date DATE,
    collection_time TIME,
    collected_by UUID,
    collection_location VARCHAR(200),
    collection_notes TEXT,
    
    -- ========================================
    -- BILLING
    -- ========================================
    is_billed BOOLEAN DEFAULT FALSE,
    invoice_id UUID,
    total_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - discount_amount + tax_amount) STORED,
    
    -- ========================================
    -- REPORTING
    -- ========================================
    report_required BOOLEAN DEFAULT TRUE,
    report_generated BOOLEAN DEFAULT FALSE,
    report_url TEXT,
    report_generated_at TIMESTAMP,
    
    -- ========================================
    -- CONSENT
    -- ========================================
    consent_taken BOOLEAN DEFAULT TRUE,
    consent_form_url TEXT,
    consent_taken_by UUID,
    
    -- ========================================
    -- NOTES
    -- ========================================
    notes TEXT,
    internal_notes TEXT,
    
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
    CONSTRAINT fk_test_orders_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_test_orders_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_test_orders_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_lab FOREIGN KEY (lab_id) 
        REFERENCES labs(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_collected_by FOREIGN KEY (collected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_consent_taken_by FOREIGN KEY (consent_taken_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_orders_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (collection_date >= order_date),
    CONSTRAINT check_amounts CHECK (total_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0),
    CONSTRAINT check_total_tests CHECK (total_tests >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_order_number ON test_orders(order_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_patient ON test_orders(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_doctor ON test_orders(doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_department ON test_orders(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_order_date ON test_orders(order_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_collection_date ON test_orders(collection_date) WHERE collection_date IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_status ON test_orders(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_priority ON test_orders(priority) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_urgent ON test_orders(is_urgent) WHERE is_urgent = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_stat ON test_orders(is_stat) WHERE is_stat = TRUE AND is_deleted = FALSE;

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_billed ON test_orders(is_billed) WHERE is_billed = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_invoice ON test_orders(invoice_id) WHERE invoice_id IS NOT NULL AND is_deleted = FALSE;

-- Reporting indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_report ON test_orders(report_required, report_generated) WHERE is_deleted = FALSE;

-- User indexes
CREATE INDEX IF NOT EXISTS idx_test_orders_collected_by ON test_orders(collected_by) WHERE collected_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_orders_created_by ON test_orders(created_by) WHERE created_by IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_test_orders_deleted ON test_orders(is_deleted, deleted_at);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_test_orders_test_items ON test_orders USING gin(test_items);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_test_orders_updated_at') THEN
        CREATE TRIGGER update_test_orders_updated_at
            BEFORE UPDATE ON test_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_test_orders_updated_at';
    END IF;
END $$;

-- Function to update total_tests from JSONB
CREATE OR REPLACE FUNCTION update_test_orders_total_tests()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_tests = jsonb_array_length(NEW.test_items);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for total_tests calculation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_test_orders_total_tests') THEN
        CREATE TRIGGER calculate_test_orders_total_tests
            BEFORE INSERT OR UPDATE OF test_items ON test_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_test_orders_total_tests();
        RAISE NOTICE 'Created trigger calculate_test_orders_total_tests';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE test_orders IS 'Complete test orders management system';
COMMENT ON COLUMN test_orders.id IS 'Primary key - UUID';
COMMENT ON COLUMN test_orders.order_number IS 'Unique order number';
COMMENT ON COLUMN test_orders.patient_id IS 'Patient reference';
COMMENT ON COLUMN test_orders.doctor_id IS 'Doctor who ordered the tests';
COMMENT ON COLUMN test_orders.department_id IS 'Department reference';
COMMENT ON COLUMN test_orders.lab_id IS 'Lab reference';
COMMENT ON COLUMN test_orders.order_date IS 'Date when order was placed';
COMMENT ON COLUMN test_orders.order_time IS 'Time when order was placed';
COMMENT ON COLUMN test_orders.priority IS 'Priority of the test order';
COMMENT ON COLUMN test_orders.clinical_notes IS 'Clinical notes from doctor';
COMMENT ON COLUMN test_orders.diagnosis IS 'Diagnosis';
COMMENT ON COLUMN test_orders.special_instructions IS 'Special instructions';
COMMENT ON COLUMN test_orders.test_items IS 'List of tests ordered in JSON';
COMMENT ON COLUMN test_orders.total_tests IS 'Total number of tests';
COMMENT ON COLUMN test_orders.status IS 'Current status of order';
COMMENT ON COLUMN test_orders.is_urgent IS 'Whether order is urgent';
COMMENT ON COLUMN test_orders.is_stat IS 'Whether order is STAT';
COMMENT ON COLUMN test_orders.is_outside_lab IS 'Whether tests are done outside';
COMMENT ON COLUMN test_orders.outside_lab_name IS 'Name of outside lab';
COMMENT ON COLUMN test_orders.collection_date IS 'Date of sample collection';
COMMENT ON COLUMN test_orders.collection_time IS 'Time of sample collection';
COMMENT ON COLUMN test_orders.collected_by IS 'User who collected sample';
COMMENT ON COLUMN test_orders.collection_location IS 'Location of collection';
COMMENT ON COLUMN test_orders.collection_notes IS 'Collection notes';
COMMENT ON COLUMN test_orders.is_billed IS 'Whether order is billed';
COMMENT ON COLUMN test_orders.invoice_id IS 'Reference to invoice';
COMMENT ON COLUMN test_orders.total_amount IS 'Total amount';
COMMENT ON COLUMN test_orders.discount_amount IS 'Discount amount';
COMMENT ON COLUMN test_orders.tax_amount IS 'Tax amount';
COMMENT ON COLUMN test_orders.net_amount IS 'Net amount after discount and tax';
COMMENT ON COLUMN test_orders.report_required IS 'Whether report is required';
COMMENT ON COLUMN test_orders.report_generated IS 'Whether report is generated';
COMMENT ON COLUMN test_orders.report_url IS 'URL to generated report';
COMMENT ON COLUMN test_orders.report_generated_at IS 'When report was generated';
COMMENT ON COLUMN test_orders.consent_taken IS 'Whether consent was taken';
COMMENT ON COLUMN test_orders.consent_form_url IS 'URL to consent form';
COMMENT ON COLUMN test_orders.consent_taken_by IS 'User who took consent';
COMMENT ON COLUMN test_orders.notes IS 'General notes';
COMMENT ON COLUMN test_orders.internal_notes IS 'Internal notes';
COMMENT ON COLUMN test_orders.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_orders') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'test_orders';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'test_orders';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'test_orders'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'test_orders'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'test_orders';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('test_priority_enum', 'test_status_enum');
    
    -- Count generated columns
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'test_orders' AND is_generated = 'ALWAYS';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 016_create_test_orders.sql COMPLETED';
    RAISE NOTICE 'Test Orders table exists: %', table_exists;
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