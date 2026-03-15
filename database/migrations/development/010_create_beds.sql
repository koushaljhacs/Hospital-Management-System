-- ============================================
-- MIGRATION: 010_create_beds.sql
-- DESCRIPTION: Create beds table with complete bed management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: patients table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create bed_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bed_type_enum') THEN
        CREATE TYPE bed_type_enum AS ENUM (
            'general',
            'semi_private',
            'private',
            'icu',
            'nicu',
            'picu',
            'emergency',
            'operation_theater',
            'recovery',
            'isolation',
            'negative_pressure',
            'burn_unit',
            'cardiac_care'
        );
        RAISE NOTICE 'Created bed_type_enum type';
    END IF;
END $$;

-- Create bed_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bed_status_enum') THEN
        CREATE TYPE bed_status_enum AS ENUM (
            'available',
            'occupied',
            'reserved',
            'cleaning',
            'maintenance',
            'out_of_service',
            'blocked'
        );
        RAISE NOTICE 'Created bed_status_enum type';
    END IF;
END $$;

-- Create cleaning_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleaning_status_enum') THEN
        CREATE TYPE cleaning_status_enum AS ENUM (
            'clean',
            'dirty',
            'in_progress',
            'disinfected',
            'sterile'
        );
        RAISE NOTICE 'Created cleaning_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE BEDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS beds (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_number VARCHAR(20) UNIQUE NOT NULL,
    
    -- ========================================
    -- LOCATION
    -- ========================================
    ward VARCHAR(100) NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    floor INTEGER,
    building VARCHAR(100),
    zone VARCHAR(50),
    
    -- ========================================
    -- BED DETAILS
    -- ========================================
    type bed_type_enum NOT NULL,
    status bed_status_enum NOT NULL DEFAULT 'available',
    sub_type VARCHAR(50),
    capacity INTEGER DEFAULT 1,
    is_isolated BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- EQUIPMENT & FEATURES
    -- ========================================
    has_ventilator BOOLEAN DEFAULT FALSE,
    has_cardiac_monitor BOOLEAN DEFAULT FALSE,
    has_oxygen_supply BOOLEAN DEFAULT TRUE,
    has_suction BOOLEAN DEFAULT FALSE,
    has_call_bell BOOLEAN DEFAULT TRUE,
    equipment_list JSONB,
    
    -- ========================================
    -- PATIENT ASSIGNMENT
    -- ========================================
    current_patient_id UUID,
    expected_discharge TIMESTAMP,
    assigned_at TIMESTAMP,
    assigned_by UUID,
    previous_patient_id UUID,
    last_occupied_from TIMESTAMP,
    last_occupied_to TIMESTAMP,
    
    -- ========================================
    -- CLEANING & MAINTENANCE
    -- ========================================
    last_cleaned TIMESTAMP,
    last_cleaned_by UUID,
    cleaning_due TIMESTAMP,
    cleaning_status cleaning_status_enum DEFAULT 'clean',
    last_maintenance TIMESTAMP,
    maintenance_due DATE,
    maintenance_notes TEXT,
    is_out_of_service BOOLEAN DEFAULT FALSE,
    out_of_service_reason TEXT,
    out_of_service_since TIMESTAMP,
    expected_service_restoration DATE,
    
    -- ========================================
    -- AMENITIES
    -- ========================================
    has_attached_bathroom BOOLEAN DEFAULT FALSE,
    has_tv BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT FALSE,
    has_ac BOOLEAN DEFAULT TRUE,
    has_fridge BOOLEAN DEFAULT FALSE,
    amenities JSONB,
    
    -- ========================================
    -- RATES & CHARGES
    -- ========================================
    daily_rate DECIMAL(10,2),
    hourly_rate DECIMAL(10,2),
    deposit_required DECIMAL(10,2),
    insurance_coverage BOOLEAN DEFAULT TRUE,
    rate_category VARCHAR(50),
    
    -- ========================================
    -- NOTES & METADATA
    -- ========================================
    notes TEXT,
    special_instructions TEXT,
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
    CONSTRAINT fk_beds_current_patient FOREIGN KEY (current_patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_beds_assigned_by FOREIGN KEY (assigned_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_beds_last_cleaned_by FOREIGN KEY (last_cleaned_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_beds_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_beds_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_beds_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (expected_discharge > assigned_at),
    CONSTRAINT check_cleaning CHECK (cleaning_due >= last_cleaned),
    CONSTRAINT check_rates CHECK (daily_rate >= 0 AND hourly_rate >= 0),
    CONSTRAINT check_capacity CHECK (capacity > 0),
    CONSTRAINT check_bed_number CHECK (length(bed_number) > 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_beds_bed_number ON beds(bed_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_type ON beds(type) WHERE is_deleted = FALSE;

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_floor ON beds(floor) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_building ON beds(building) WHERE building IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_zone ON beds(zone) WHERE zone IS NOT NULL AND is_deleted = FALSE;

-- Patient assignment indexes
CREATE INDEX IF NOT EXISTS idx_beds_current_patient ON beds(current_patient_id) WHERE current_patient_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_expected_discharge ON beds(expected_discharge) WHERE expected_discharge IS NOT NULL AND is_deleted = FALSE;

-- Cleaning & maintenance indexes
CREATE INDEX IF NOT EXISTS idx_beds_cleaning_status ON beds(cleaning_status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_cleaning_due ON beds(cleaning_due) WHERE cleaning_due IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_maintenance_due ON beds(maintenance_due) WHERE maintenance_due IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_out_of_service ON beds(is_out_of_service) WHERE is_out_of_service = TRUE AND is_deleted = FALSE;

-- Features indexes
CREATE INDEX IF NOT EXISTS idx_beds_isolated ON beds(is_isolated) WHERE is_isolated = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_private ON beds(is_private) WHERE is_private = TRUE AND is_deleted = FALSE;

-- Rates indexes
CREATE INDEX IF NOT EXISTS idx_beds_daily_rate ON beds(daily_rate) WHERE daily_rate IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_beds_rate_category ON beds(rate_category) WHERE rate_category IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_beds_deleted ON beds(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_beds_equipment ON beds USING gin(equipment_list);
CREATE INDEX IF NOT EXISTS idx_beds_amenities ON beds USING gin(amenities);
CREATE INDEX IF NOT EXISTS idx_beds_metadata ON beds USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_beds_updated_at') THEN
        CREATE TRIGGER update_beds_updated_at
            BEFORE UPDATE ON beds
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_beds_updated_at';
    END IF;
END $$;

-- Function to update cleaning status when bed becomes available
CREATE OR REPLACE FUNCTION update_bed_cleaning_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'available' AND OLD.status != 'available' THEN
        NEW.cleaning_status = 'clean';
        NEW.last_cleaned = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for cleaning status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bed_cleaning_status') THEN
        CREATE TRIGGER update_bed_cleaning_status
            BEFORE UPDATE OF status ON beds
            FOR EACH ROW
            EXECUTE FUNCTION update_bed_cleaning_status();
        RAISE NOTICE 'Created trigger update_bed_cleaning_status';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE beds IS 'Complete hospital bed management system';
COMMENT ON COLUMN beds.id IS 'Primary key - UUID';
COMMENT ON COLUMN beds.bed_number IS 'Unique bed identifier';
COMMENT ON COLUMN beds.ward IS 'Ward name/number';
COMMENT ON COLUMN beds.room_number IS 'Room number';
COMMENT ON COLUMN beds.floor IS 'Floor number';
COMMENT ON COLUMN beds.building IS 'Building name';
COMMENT ON COLUMN beds.zone IS 'Zone/section (East/West Wing)';
COMMENT ON COLUMN beds.type IS 'Type of bed';
COMMENT ON COLUMN beds.status IS 'Current bed status';
COMMENT ON COLUMN beds.sub_type IS 'Specific bed subtype';
COMMENT ON COLUMN beds.capacity IS 'Bed capacity (for multi-occupancy)';
COMMENT ON COLUMN beds.is_isolated IS 'Whether bed is for isolation';
COMMENT ON COLUMN beds.is_private IS 'Whether bed is private';
COMMENT ON COLUMN beds.has_ventilator IS 'Whether bed has ventilator';
COMMENT ON COLUMN beds.has_cardiac_monitor IS 'Whether bed has cardiac monitor';
COMMENT ON COLUMN beds.has_oxygen_supply IS 'Whether bed has oxygen supply';
COMMENT ON COLUMN beds.has_suction IS 'Whether bed has suction';
COMMENT ON COLUMN beds.has_call_bell IS 'Whether bed has call bell';
COMMENT ON COLUMN beds.equipment_list IS 'Additional equipment in JSON';
COMMENT ON COLUMN beds.current_patient_id IS 'Currently assigned patient';
COMMENT ON COLUMN beds.expected_discharge IS 'Expected discharge time';
COMMENT ON COLUMN beds.assigned_at IS 'When patient was assigned';
COMMENT ON COLUMN beds.assigned_by IS 'User who assigned patient';
COMMENT ON COLUMN beds.previous_patient_id IS 'Previously assigned patient';
COMMENT ON COLUMN beds.last_occupied_from IS 'Last occupancy start time';
COMMENT ON COLUMN beds.last_occupied_to IS 'Last occupancy end time';
COMMENT ON COLUMN beds.last_cleaned IS 'Last cleaning timestamp';
COMMENT ON COLUMN beds.last_cleaned_by IS 'User who last cleaned';
COMMENT ON COLUMN beds.cleaning_due IS 'Next cleaning due time';
COMMENT ON COLUMN beds.cleaning_status IS 'Current cleaning status';
COMMENT ON COLUMN beds.last_maintenance IS 'Last maintenance timestamp';
COMMENT ON COLUMN beds.maintenance_due IS 'Next maintenance due date';
COMMENT ON COLUMN beds.maintenance_notes IS 'Maintenance notes';
COMMENT ON COLUMN beds.is_out_of_service IS 'Whether bed is out of service';
COMMENT ON COLUMN beds.out_of_service_reason IS 'Reason for out of service';
COMMENT ON COLUMN beds.out_of_service_since IS 'When bed went out of service';
COMMENT ON COLUMN beds.expected_service_restoration IS 'Expected restoration date';
COMMENT ON COLUMN beds.has_attached_bathroom IS 'Whether bed has attached bathroom';
COMMENT ON COLUMN beds.has_tv IS 'Whether bed has TV';
COMMENT ON COLUMN beds.has_wifi IS 'Whether bed has WiFi';
COMMENT ON COLUMN beds.has_ac IS 'Whether bed has AC';
COMMENT ON COLUMN beds.has_fridge IS 'Whether bed has fridge';
COMMENT ON COLUMN beds.amenities IS 'Additional amenities in JSON';
COMMENT ON COLUMN beds.daily_rate IS 'Daily rate for bed';
COMMENT ON COLUMN beds.hourly_rate IS 'Hourly rate for bed';
COMMENT ON COLUMN beds.deposit_required IS 'Required deposit amount';
COMMENT ON COLUMN beds.insurance_coverage IS 'Whether insurance covers bed';
COMMENT ON COLUMN beds.rate_category IS 'Rate category (General/ICU/Private)';
COMMENT ON COLUMN beds.notes IS 'General notes';
COMMENT ON COLUMN beds.special_instructions IS 'Special instructions';
COMMENT ON COLUMN beds.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN beds.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beds') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'beds';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'beds';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'beds'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'beds'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'beds';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('bed_type_enum', 'bed_status_enum', 'cleaning_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 010_create_beds.sql COMPLETED';
    RAISE NOTICE 'Beds table exists: %', table_exists;
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