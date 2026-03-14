-- ============================================
-- MIGRATION: 006_create_medicines.sql
-- DESCRIPTION: Create medicines table for prescriptions
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: 005_create_prescriptions.sql
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create medicine_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medicine_status_enum') THEN
        CREATE TYPE medicine_status_enum AS ENUM (
            'active',
            'discontinued',
            'substituted',
            'cancelled'
        );
        RAISE NOTICE 'Created medicine_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE MEDICINES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS medicines (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL,
    
    -- ========================================
    -- MEDICINE DETAILS
    -- ========================================
    medicine_name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200),
    dosage VARCHAR(50) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    units VARCHAR(20) DEFAULT 'tablets',
    route VARCHAR(50) DEFAULT 'oral',
    
    -- ========================================
    -- TIMING INSTRUCTIONS
    -- ========================================
    timing JSONB,
    with_food BOOLEAN DEFAULT FALSE,
    before_food BOOLEAN DEFAULT FALSE,
    after_food BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- ADDITIONAL INSTRUCTIONS
    -- ========================================
    instructions TEXT,
    side_effects TEXT,
    
    -- ========================================
    -- REFILL INFORMATION
    -- ========================================
    refills_allowed INTEGER DEFAULT 0,
    refills_used INTEGER DEFAULT 0,
    refill_expiry DATE,
    
    -- ========================================
    -- SUBSTITUTION
    -- ========================================
    substitute_allowed BOOLEAN DEFAULT TRUE,
    substitute_medicine_id UUID,
    substitution_reason TEXT,
    
    -- ========================================
    -- STATUS
    -- ========================================
    status medicine_status_enum DEFAULT 'active',
    
    -- ========================================
    -- AUDIT COLUMNS
    -- ========================================
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
    CONSTRAINT fk_medicines_prescription FOREIGN KEY (prescription_id) 
        REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_medicines_substitute FOREIGN KEY (substitute_medicine_id) 
        REFERENCES medicines(id) ON DELETE SET NULL,
    CONSTRAINT fk_medicines_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_quantity_positive CHECK (quantity > 0),
    CONSTRAINT check_refills_allowed CHECK (refills_allowed >= 0),
    CONSTRAINT check_refills_used CHECK (refills_used >= 0 AND refills_used <= refills_allowed),
    CONSTRAINT check_refill_expiry CHECK (
        refill_expiry IS NULL OR refill_expiry > CURRENT_DATE
    ),
    CONSTRAINT check_substitute_not_self CHECK (
        substitute_medicine_id IS NULL OR substitute_medicine_id != id
    )
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_medicines_prescription_id 
    ON medicines(prescription_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_medicines_substitute_id 
    ON medicines(substitute_medicine_id) WHERE substitute_medicine_id IS NOT NULL;

-- Medicine search indexes
CREATE INDEX IF NOT EXISTS idx_medicines_name 
    ON medicines(medicine_name) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_medicines_generic_name 
    ON medicines(generic_name) WHERE generic_name IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_medicines_status 
    ON medicines(status) WHERE is_deleted = FALSE;

-- Refill indexes
CREATE INDEX IF NOT EXISTS idx_medicines_refill_expiry 
    ON medicines(refill_expiry) WHERE refill_expiry IS NOT NULL AND is_deleted = FALSE;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_medicines_timing 
    ON medicines USING gin(timing);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_medicines_deleted 
    ON medicines(is_deleted, deleted_at);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_medicines_updated_at') THEN
        CREATE TRIGGER update_medicines_updated_at
            BEFORE UPDATE ON medicines
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_medicines_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE medicines IS 'Medicines prescribed in prescriptions';
COMMENT ON COLUMN medicines.id IS 'Primary key - UUID';
COMMENT ON COLUMN medicines.prescription_id IS 'Foreign key to prescriptions table';
COMMENT ON COLUMN medicines.medicine_name IS 'Brand/trade name of medicine';
COMMENT ON COLUMN medicines.generic_name IS 'Generic/scientific name';
COMMENT ON COLUMN medicines.dosage IS 'Dosage strength (e.g., 500mg, 1 tablet)';
COMMENT ON COLUMN medicines.frequency IS 'How often to take (e.g., twice daily)';
COMMENT ON COLUMN medicines.duration IS 'How long to take (e.g., 7 days)';
COMMENT ON COLUMN medicines.quantity IS 'Total quantity prescribed';
COMMENT ON COLUMN medicines.units IS 'Unit of measurement (tablets/ml/mg)';
COMMENT ON COLUMN medicines.route IS 'Route of administration (oral/topical/IV)';
COMMENT ON COLUMN medicines.timing IS 'Structured timing instructions in JSON';
COMMENT ON COLUMN medicines.with_food IS 'Take with food';
COMMENT ON COLUMN medicines.before_food IS 'Take before food';
COMMENT ON COLUMN medicines.after_food IS 'Take after food';
COMMENT ON COLUMN medicines.instructions IS 'Special instructions for taking medicine';
COMMENT ON COLUMN medicines.side_effects IS 'Possible side effects';
COMMENT ON COLUMN medicines.refills_allowed IS 'Number of refills permitted';
COMMENT ON COLUMN medicines.refills_used IS 'Number of refills already used';
COMMENT ON COLUMN medicines.refill_expiry IS 'Date until which refills are valid';
COMMENT ON COLUMN medicines.substitute_allowed IS 'Whether generic substitution is allowed';
COMMENT ON COLUMN medicines.substitute_medicine_id IS 'Substituted medicine ID if changed';
COMMENT ON COLUMN medicines.substitution_reason IS 'Reason for substitution';
COMMENT ON COLUMN medicines.status IS 'Current status of medicine';
COMMENT ON COLUMN medicines.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medicines') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'medicines';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'medicines';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'medicines'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'medicines'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'medicines';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname = 'medicine_status_enum';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 006_create_medicines.sql COMPLETED';
    RAISE NOTICE 'Medicines table exists: %', table_exists;
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