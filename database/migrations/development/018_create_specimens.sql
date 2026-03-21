
-- ============================================
-- MIGRATION: 018_create_specimens.sql
-- DESCRIPTION: Create specimens table for sample management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: patients table, test_orders table, labs table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create specimen_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specimen_type_enum') THEN
        CREATE TYPE specimen_type_enum AS ENUM (
            'blood',
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
        RAISE NOTICE 'Created specimen_type_enum type';
    END IF;
END $$;

-- Create specimen_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specimen_status_enum') THEN
        CREATE TYPE specimen_status_enum AS ENUM (
            'collected',
            'received',
            'processing',
            'processed',
            'analyzing',
            'completed',
            'rejected',
            'expired',
            'discarded'
        );
        RAISE NOTICE 'Created specimen_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE SPECIMENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS specimens (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specimen_code VARCHAR(50) UNIQUE NOT NULL,
    specimen_type specimen_type_enum NOT NULL,
    specimen_name VARCHAR(200) NOT NULL,
    
    -- ========================================
    -- COLLECTION DETAILS
    -- ========================================
    collection_date TIMESTAMP NOT NULL,
    collected_by UUID NOT NULL,
    collection_site VARCHAR(200),
    collection_method VARCHAR(100),
    collection_notes TEXT,
    
    -- ========================================
    -- PATIENT DETAILS
    -- ========================================
    patient_id UUID NOT NULL,
    patient_type VARCHAR(50),
    visit_id UUID,
    
    -- ========================================
    -- TEST ORDER
    -- ========================================
    test_order_id UUID NOT NULL,
    lab_id UUID,
    
    -- ========================================
    -- SPECIMEN CHARACTERISTICS
    -- ========================================
    volume DECIMAL(10,2),
    volume_unit VARCHAR(20),
    container_type VARCHAR(100),
    preservative VARCHAR(100),
    appearance VARCHAR(100),
    color VARCHAR(50),
    odor VARCHAR(50),
    consistency VARCHAR(50),
    
    -- ========================================
    -- STORAGE & TRANSPORT
    -- ========================================
    storage_conditions TEXT,
    transport_conditions TEXT,
    received_date TIMESTAMP,
    received_by UUID,
    received_condition VARCHAR(100),
    received_notes TEXT,
    
    -- ========================================
    -- QUALITY CONTROL
    -- ========================================
    is_hemolyzed BOOLEAN DEFAULT FALSE,
    is_icteric BOOLEAN DEFAULT FALSE,
    is_lipemic BOOLEAN DEFAULT FALSE,
    is_clotted BOOLEAN DEFAULT FALSE,
    is_contaminated BOOLEAN DEFAULT FALSE,
    is_insufficient BOOLEAN DEFAULT FALSE,
    qc_status VARCHAR(50),
    qc_notes TEXT,
    
    -- ========================================
    -- STATUS
    -- ========================================
    status specimen_status_enum DEFAULT 'collected',
    rejection_reason TEXT,
    rejected_by UUID,
    rejected_at TIMESTAMP,
    
    -- ========================================
    -- PROCESSING
    -- ========================================
    processed_by UUID,
    processed_at TIMESTAMP,
    processed_notes TEXT,
    aliquots INTEGER DEFAULT 1,
    
    -- ========================================
    -- STORAGE LOCATION
    -- ========================================
    storage_location VARCHAR(200),
    freezer_id UUID,
    rack_number VARCHAR(50),
    shelf_number VARCHAR(50),
    box_number VARCHAR(50),
    position VARCHAR(50),
    
    -- ========================================
    -- EXPIRY
    -- ========================================
    expiry_date DATE,
    expiry_alert_sent BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- ATTACHMENTS
    -- ========================================
    image_urls TEXT[],
    documents JSONB,
    
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
    CONSTRAINT fk_specimens_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_specimens_test_order FOREIGN KEY (test_order_id) 
        REFERENCES test_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_specimens_lab FOREIGN KEY (lab_id) 
        REFERENCES labs(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_collected_by FOREIGN KEY (collected_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_specimens_received_by FOREIGN KEY (received_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_rejected_by FOREIGN KEY (rejected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_processed_by FOREIGN KEY (processed_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_specimens_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (received_date >= collection_date),
    CONSTRAINT check_expiry CHECK (expiry_date >= collection_date::DATE),
    CONSTRAINT check_volume CHECK (volume >= 0),
    CONSTRAINT check_aliquots CHECK (aliquots >= 1)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_specimens_code ON specimens(specimen_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_type ON specimens(specimen_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_name ON specimens(specimen_name) WHERE is_deleted = FALSE;

-- Patient & order indexes
CREATE INDEX IF NOT EXISTS idx_specimens_patient ON specimens(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_test_order ON specimens(test_order_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_lab ON specimens(lab_id) WHERE lab_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_specimens_collection_date ON specimens(collection_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_received_date ON specimens(received_date) WHERE received_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_expiry ON specimens(expiry_date) WHERE expiry_date IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_specimens_status ON specimens(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_qc_status ON specimens(qc_status) WHERE qc_status IS NOT NULL AND is_deleted = FALSE;

-- Quality control indexes
CREATE INDEX IF NOT EXISTS idx_specimens_hemolyzed ON specimens(is_hemolyzed) WHERE is_hemolyzed = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_insufficient ON specimens(is_insufficient) WHERE is_insufficient = TRUE AND is_deleted = FALSE;

-- User indexes
CREATE INDEX IF NOT EXISTS idx_specimens_collected_by ON specimens(collected_by) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_received_by ON specimens(received_by) WHERE received_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_processed_by ON specimens(processed_by) WHERE processed_by IS NOT NULL AND is_deleted = FALSE;

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_specimens_storage_location ON specimens(storage_location) WHERE storage_location IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_specimens_freezer ON specimens(freezer_id) WHERE freezer_id IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_specimens_deleted ON specimens(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_specimens_image_urls ON specimens USING gin(image_urls);
CREATE INDEX IF NOT EXISTS idx_specimens_documents ON specimens USING gin(documents);
CREATE INDEX IF NOT EXISTS idx_specimens_metadata ON specimens USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_specimens_updated_at') THEN
        CREATE TRIGGER update_specimens_updated_at
            BEFORE UPDATE ON specimens
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_specimens_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE specimens IS 'Complete specimen/sample management system';
COMMENT ON COLUMN specimens.id IS 'Primary key - UUID';
COMMENT ON COLUMN specimens.specimen_code IS 'Unique specimen code';
COMMENT ON COLUMN specimens.specimen_type IS 'Type of specimen';
COMMENT ON COLUMN specimens.specimen_name IS 'Name/description of specimen';
COMMENT ON COLUMN specimens.collection_date IS 'When specimen was collected';
COMMENT ON COLUMN specimens.collected_by IS 'User who collected specimen';
COMMENT ON COLUMN specimens.collection_site IS 'Site of collection';
COMMENT ON COLUMN specimens.collection_method IS 'Method of collection';
COMMENT ON COLUMN specimens.collection_notes IS 'Collection notes';
COMMENT ON COLUMN specimens.patient_id IS 'Patient reference';
COMMENT ON COLUMN specimens.patient_type IS 'Patient type (inpatient/outpatient)';
COMMENT ON COLUMN specimens.visit_id IS 'Visit reference';
COMMENT ON COLUMN specimens.test_order_id IS 'Test order reference';
COMMENT ON COLUMN specimens.lab_id IS 'Lab reference';
COMMENT ON COLUMN specimens.volume IS 'Volume of specimen';
COMMENT ON COLUMN specimens.volume_unit IS 'Unit of volume';
COMMENT ON COLUMN specimens.container_type IS 'Type of container';
COMMENT ON COLUMN specimens.preservative IS 'Preservative used';
COMMENT ON COLUMN specimens.appearance IS 'Appearance of specimen';
COMMENT ON COLUMN specimens.color IS 'Color of specimen';
COMMENT ON COLUMN specimens.odor IS 'Odor of specimen';
COMMENT ON COLUMN specimens.consistency IS 'Consistency of specimen';
COMMENT ON COLUMN specimens.storage_conditions IS 'Storage conditions required';
COMMENT ON COLUMN specimens.transport_conditions IS 'Transport conditions required';
COMMENT ON COLUMN specimens.received_date IS 'When specimen was received';
COMMENT ON COLUMN specimens.received_by IS 'User who received specimen';
COMMENT ON COLUMN specimens.received_condition IS 'Condition on receipt';
COMMENT ON COLUMN specimens.received_notes IS 'Receiving notes';
COMMENT ON COLUMN specimens.is_hemolyzed IS 'Whether specimen is hemolyzed';
COMMENT ON COLUMN specimens.is_icteric IS 'Whether specimen is icteric';
COMMENT ON COLUMN specimens.is_lipemic IS 'Whether specimen is lipemic';
COMMENT ON COLUMN specimens.is_clotted IS 'Whether specimen is clotted';
COMMENT ON COLUMN specimens.is_contaminated IS 'Whether specimen is contaminated';
COMMENT ON COLUMN specimens.is_insufficient IS 'Whether specimen quantity is insufficient';
COMMENT ON COLUMN specimens.qc_status IS 'Quality control status';
COMMENT ON COLUMN specimens.qc_notes IS 'Quality control notes';
COMMENT ON COLUMN specimens.status IS 'Current specimen status';
COMMENT ON COLUMN specimens.rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN specimens.rejected_by IS 'User who rejected';
COMMENT ON COLUMN specimens.rejected_at IS 'Rejection timestamp';
COMMENT ON COLUMN specimens.processed_by IS 'User who processed';
COMMENT ON COLUMN specimens.processed_at IS 'Processing timestamp';
COMMENT ON COLUMN specimens.processed_notes IS 'Processing notes';
COMMENT ON COLUMN specimens.aliquots IS 'Number of aliquots';
COMMENT ON COLUMN specimens.storage_location IS 'Storage location';
COMMENT ON COLUMN specimens.freezer_id IS 'Freezer reference';
COMMENT ON COLUMN specimens.rack_number IS 'Rack number';
COMMENT ON COLUMN specimens.shelf_number IS 'Shelf number';
COMMENT ON COLUMN specimens.box_number IS 'Box number';
COMMENT ON COLUMN specimens.position IS 'Position in box';
COMMENT ON COLUMN specimens.expiry_date IS 'Expiry date';
COMMENT ON COLUMN specimens.expiry_alert_sent IS 'Whether expiry alert sent';
COMMENT ON COLUMN specimens.image_urls IS 'URLs to images';
COMMENT ON COLUMN specimens.documents IS 'Documents in JSON';
COMMENT ON COLUMN specimens.notes IS 'General notes';
COMMENT ON COLUMN specimens.internal_notes IS 'Internal notes';
COMMENT ON COLUMN specimens.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN specimens.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'specimens') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'specimens';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'specimens';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'specimens'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'specimens'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'specimens';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('specimen_type_enum', 'specimen_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 018_create_specimens.sql COMPLETED';
    RAISE NOTICE 'Specimens table exists: %', table_exists;
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