-- ============================================
-- MIGRATION: 014_create_equipment.sql
-- DESCRIPTION: Create equipment table for biomedical equipment management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: departments table, suppliers table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create equipment_category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_category_enum') THEN
        CREATE TYPE equipment_category_enum AS ENUM (
            'diagnostic',
            'therapeutic',
            'surgical',
            'monitoring',
            'laboratory',
            'imaging',
            'sterilization',
            'patient_care',
            'emergency',
            'office',
            'other'
        );
        RAISE NOTICE 'Created equipment_category_enum type';
    END IF;
END $$;

-- Create equipment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status_enum') THEN
        CREATE TYPE equipment_status_enum AS ENUM (
            'operational',
            'under_maintenance',
            'repair_required',
            'calibration_due',
            'out_of_service',
            'retired',
            'reserved'
        );
        RAISE NOTICE 'Created equipment_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE EQUIPMENT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS equipment (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category equipment_category_enum NOT NULL,
    
    -- ========================================
    -- CLASSIFICATION
    -- ========================================
    type VARCHAR(100),
    sub_type VARCHAR(100),
    manufacturer VARCHAR(200),
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    year_of_manufacture INTEGER,
    country_of_origin VARCHAR(100),
    
    -- ========================================
    -- DEPARTMENT & LOCATION
    -- ========================================
    department_id UUID,
    location VARCHAR(200),
    room_number VARCHAR(50),
    floor INTEGER,
    building VARCHAR(100),
    
    -- ========================================
    -- PURCHASE DETAILS
    -- ========================================
    purchase_date DATE,
    purchase_cost DECIMAL(12,2),
    supplier_id UUID,
    invoice_number VARCHAR(100),
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_terms TEXT,
    amc_start_date DATE,
    amc_end_date DATE,
    amc_provider VARCHAR(200),
    amc_cost DECIMAL(12,2),
    
    -- ========================================
    -- TECHNICAL SPECIFICATIONS
    -- ========================================
    specifications JSONB,
    power_requirements VARCHAR(100),
    voltage VARCHAR(20),
    frequency VARCHAR(20),
    power_consumption VARCHAR(50),
    dimensions VARCHAR(100),
    weight DECIMAL(10,2),
    color VARCHAR(50),
    accessories JSONB,
    
    -- ========================================
    -- CALIBRATION & MAINTENANCE
    -- ========================================
    calibration_required BOOLEAN DEFAULT TRUE,
    calibration_frequency VARCHAR(50),
    last_calibration_date DATE,
    next_calibration_date DATE,
    calibration_due_alert INTEGER DEFAULT 30,
    maintenance_required BOOLEAN DEFAULT TRUE,
    maintenance_frequency VARCHAR(50),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_due_alert INTEGER DEFAULT 15,
    maintenance_instructions TEXT,
    maintenance_log JSONB,
    
    -- ========================================
    -- STATUS & AVAILABILITY
    -- ========================================
    status equipment_status_enum DEFAULT 'operational',
    operational_status VARCHAR(50),
    is_available BOOLEAN DEFAULT TRUE,
    available_from TIMESTAMP,
    available_to TIMESTAMP,
    downtime_reason TEXT,
    downtime_start TIMESTAMP,
    downtime_end TIMESTAMP,
    estimated_repair_date DATE,
    
    -- ========================================
    -- USAGE TRACKING
    -- ========================================
    total_usage_hours INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_date DATE,
    last_used_by UUID,
    assigned_to UUID,
    assigned_date TIMESTAMP,
    
    -- ========================================
    -- DOCUMENTS
    -- ========================================
    manual_url TEXT,
    certificate_url TEXT,
    warranty_document_url TEXT,
    amc_document_url TEXT,
    calibration_certificate_url TEXT,
    insurance_document_url TEXT,
    other_documents JSONB,
    
    -- ========================================
    -- INSURANCE DETAILS
    -- ========================================
    insurance_required BOOLEAN DEFAULT FALSE,
    insurance_provider VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    insurance_cover_amount DECIMAL(12,2),
    insurance_start_date DATE,
    insurance_end_date DATE,
    
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
    CONSTRAINT fk_equipment_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_supplier FOREIGN KEY (supplier_id) 
        REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_last_used_by FOREIGN KEY (last_used_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_assigned_to FOREIGN KEY (assigned_to) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_equipment_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_warranty_dates CHECK (warranty_end_date >= warranty_start_date),
    CONSTRAINT check_amc_dates CHECK (amc_end_date >= amc_start_date),
    CONSTRAINT check_insurance_dates CHECK (insurance_end_date >= insurance_start_date),
    CONSTRAINT check_calibration_dates CHECK (next_calibration_date > last_calibration_date),
    CONSTRAINT check_maintenance_dates CHECK (next_maintenance_date > last_maintenance_date),
    CONSTRAINT check_purchase_cost CHECK (purchase_cost >= 0),
    CONSTRAINT check_amc_cost CHECK (amc_cost >= 0),
    CONSTRAINT check_insurance_amount CHECK (insurance_cover_amount >= 0),
    CONSTRAINT check_usage CHECK (total_usage_hours >= 0 AND total_usage_count >= 0),
    CONSTRAINT check_alert_days CHECK (calibration_due_alert >= 0 AND maintenance_due_alert >= 0),
    CONSTRAINT check_year CHECK (year_of_manufacture BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE) + 5),
    CONSTRAINT check_weight CHECK (weight >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(equipment_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number) WHERE serial_number IS NOT NULL AND is_deleted = FALSE;

-- Classification indexes
CREATE INDEX IF NOT EXISTS idx_equipment_manufacturer ON equipment(manufacturer) WHERE manufacturer IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_model ON equipment(model) WHERE model IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type) WHERE type IS NOT NULL AND is_deleted = FALSE;

-- Department & location indexes
CREATE INDEX IF NOT EXISTS idx_equipment_department ON equipment(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(location) WHERE location IS NOT NULL AND is_deleted = FALSE;

-- Purchase & warranty indexes
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_date ON equipment(purchase_date) WHERE purchase_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_supplier ON equipment(supplier_id) WHERE supplier_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_warranty ON equipment(warranty_end_date) WHERE warranty_end_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_amc ON equipment(amc_end_date) WHERE amc_end_date IS NOT NULL AND is_deleted = FALSE;

-- Calibration & maintenance indexes
CREATE INDEX IF NOT EXISTS idx_equipment_calibration ON equipment(next_calibration_date) WHERE next_calibration_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance ON equipment(next_maintenance_date) WHERE next_maintenance_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_calibration_due ON equipment(calibration_due_alert) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON equipment(maintenance_due_alert) WHERE is_deleted = FALSE;

-- Status & availability indexes
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available) WHERE is_available = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_downtime ON equipment(downtime_start, downtime_end) WHERE is_deleted = FALSE;

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_equipment_last_used ON equipment(last_used_date) WHERE last_used_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_equipment_assigned ON equipment(assigned_to) WHERE assigned_to IS NOT NULL AND is_deleted = FALSE;

-- Insurance indexes
CREATE INDEX IF NOT EXISTS idx_equipment_insurance ON equipment(insurance_end_date) WHERE insurance_end_date IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_equipment_deleted ON equipment(is_deleted, deleted_at);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_equipment_specifications ON equipment USING gin(specifications);
CREATE INDEX IF NOT EXISTS idx_equipment_accessories ON equipment USING gin(accessories);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_log ON equipment USING gin(maintenance_log);
CREATE INDEX IF NOT EXISTS idx_equipment_other_docs ON equipment USING gin(other_documents);
CREATE INDEX IF NOT EXISTS idx_equipment_metadata ON equipment USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_equipment_updated_at') THEN
        CREATE TRIGGER update_equipment_updated_at
            BEFORE UPDATE ON equipment
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_equipment_updated_at';
    END IF;
END $$;

-- Function to update status based on dates
CREATE OR REPLACE FUNCTION update_equipment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for calibration due
    IF NEW.next_calibration_date IS NOT NULL AND NEW.next_calibration_date <= CURRENT_DATE THEN
        NEW.status = 'calibration_due';
    -- Check for maintenance due
    ELSIF NEW.next_maintenance_date IS NOT NULL AND NEW.next_maintenance_date <= CURRENT_DATE THEN
        NEW.status = 'under_maintenance';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_equipment_status_trigger') THEN
        CREATE TRIGGER update_equipment_status_trigger
            BEFORE INSERT OR UPDATE OF next_calibration_date, next_maintenance_date ON equipment
            FOR EACH ROW
            EXECUTE FUNCTION update_equipment_status();
        RAISE NOTICE 'Created trigger update_equipment_status_trigger';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE equipment IS 'Complete biomedical equipment management system';
COMMENT ON COLUMN equipment.id IS 'Primary key - UUID';
COMMENT ON COLUMN equipment.equipment_code IS 'Unique equipment code';
COMMENT ON COLUMN equipment.name IS 'Equipment name';
COMMENT ON COLUMN equipment.description IS 'Detailed description';
COMMENT ON COLUMN equipment.category IS 'Equipment category';
COMMENT ON COLUMN equipment.type IS 'Equipment type';
COMMENT ON COLUMN equipment.sub_type IS 'Equipment sub-type';
COMMENT ON COLUMN equipment.manufacturer IS 'Manufacturer name';
COMMENT ON COLUMN equipment.model IS 'Model number';
COMMENT ON COLUMN equipment.serial_number IS 'Unique serial number';
COMMENT ON COLUMN equipment.year_of_manufacture IS 'Year of manufacture';
COMMENT ON COLUMN equipment.country_of_origin IS 'Country of origin';
COMMENT ON COLUMN equipment.department_id IS 'Department where equipment is located';
COMMENT ON COLUMN equipment.location IS 'Physical location';
COMMENT ON COLUMN equipment.room_number IS 'Room number';
COMMENT ON COLUMN equipment.floor IS 'Floor number';
COMMENT ON COLUMN equipment.building IS 'Building name';
COMMENT ON COLUMN equipment.purchase_date IS 'Date of purchase';
COMMENT ON COLUMN equipment.purchase_cost IS 'Purchase cost';
COMMENT ON COLUMN equipment.supplier_id IS 'Supplier reference';
COMMENT ON COLUMN equipment.invoice_number IS 'Purchase invoice number';
COMMENT ON COLUMN equipment.warranty_start_date IS 'Warranty start date';
COMMENT ON COLUMN equipment.warranty_end_date IS 'Warranty end date';
COMMENT ON COLUMN equipment.warranty_terms IS 'Warranty terms and conditions';
COMMENT ON COLUMN equipment.amc_start_date IS 'AMC start date';
COMMENT ON COLUMN equipment.amc_end_date IS 'AMC end date';
COMMENT ON COLUMN equipment.amc_provider IS 'AMC provider';
COMMENT ON COLUMN equipment.amc_cost IS 'AMC cost';
COMMENT ON COLUMN equipment.specifications IS 'Technical specifications in JSON';
COMMENT ON COLUMN equipment.power_requirements IS 'Power requirements';
COMMENT ON COLUMN equipment.voltage IS 'Voltage rating';
COMMENT ON COLUMN equipment.frequency IS 'Frequency rating';
COMMENT ON COLUMN equipment.power_consumption IS 'Power consumption';
COMMENT ON COLUMN equipment.dimensions IS 'Dimensions';
COMMENT ON COLUMN equipment.weight IS 'Weight';
COMMENT ON COLUMN equipment.color IS 'Color';
COMMENT ON COLUMN equipment.accessories IS 'Accessories in JSON';
COMMENT ON COLUMN equipment.calibration_required IS 'Whether calibration is required';
COMMENT ON COLUMN equipment.calibration_frequency IS 'Calibration frequency';
COMMENT ON COLUMN equipment.last_calibration_date IS 'Last calibration date';
COMMENT ON COLUMN equipment.next_calibration_date IS 'Next calibration due date';
COMMENT ON COLUMN equipment.calibration_due_alert IS 'Days before calibration due to alert';
COMMENT ON COLUMN equipment.maintenance_required IS 'Whether maintenance is required';
COMMENT ON COLUMN equipment.maintenance_frequency IS 'Maintenance frequency';
COMMENT ON COLUMN equipment.last_maintenance_date IS 'Last maintenance date';
COMMENT ON COLUMN equipment.next_maintenance_date IS 'Next maintenance due date';
COMMENT ON COLUMN equipment.maintenance_due_alert IS 'Days before maintenance due to alert';
COMMENT ON COLUMN equipment.maintenance_instructions IS 'Maintenance instructions';
COMMENT ON COLUMN equipment.maintenance_log IS 'Maintenance history log in JSON';
COMMENT ON COLUMN equipment.status IS 'Current equipment status';
COMMENT ON COLUMN equipment.operational_status IS 'Detailed operational status';
COMMENT ON COLUMN equipment.is_available IS 'Whether equipment is available for use';
COMMENT ON COLUMN equipment.available_from IS 'Available from timestamp';
COMMENT ON COLUMN equipment.available_to IS 'Available until timestamp';
COMMENT ON COLUMN equipment.downtime_reason IS 'Reason for downtime';
COMMENT ON COLUMN equipment.downtime_start IS 'Downtime start timestamp';
COMMENT ON COLUMN equipment.downtime_end IS 'Downtime end timestamp';
COMMENT ON COLUMN equipment.estimated_repair_date IS 'Estimated repair completion date';
COMMENT ON COLUMN equipment.total_usage_hours IS 'Total hours of usage';
COMMENT ON COLUMN equipment.total_usage_count IS 'Total number of times used';
COMMENT ON COLUMN equipment.last_used_date IS 'Last used date';
COMMENT ON COLUMN equipment.last_used_by IS 'User who last used';
COMMENT ON COLUMN equipment.assigned_to IS 'User assigned to equipment';
COMMENT ON COLUMN equipment.assigned_date IS 'Assignment date';
COMMENT ON COLUMN equipment.manual_url IS 'URL to user manual';
COMMENT ON COLUMN equipment.certificate_url IS 'URL to certificate';
COMMENT ON COLUMN equipment.warranty_document_url IS 'URL to warranty document';
COMMENT ON COLUMN equipment.amc_document_url IS 'URL to AMC document';
COMMENT ON COLUMN equipment.calibration_certificate_url IS 'URL to calibration certificate';
COMMENT ON COLUMN equipment.insurance_document_url IS 'URL to insurance document';
COMMENT ON COLUMN equipment.other_documents IS 'Other documents in JSON';
COMMENT ON COLUMN equipment.insurance_required IS 'Whether insurance is required';
COMMENT ON COLUMN equipment.insurance_provider IS 'Insurance provider name';
COMMENT ON COLUMN equipment.insurance_policy_number IS 'Insurance policy number';
COMMENT ON COLUMN equipment.insurance_cover_amount IS 'Insurance coverage amount';
COMMENT ON COLUMN equipment.insurance_start_date IS 'Insurance start date';
COMMENT ON COLUMN equipment.insurance_end_date IS 'Insurance end date';
COMMENT ON COLUMN equipment.notes IS 'General notes';
COMMENT ON COLUMN equipment.special_instructions IS 'Special instructions';
COMMENT ON COLUMN equipment.metadata IS 'Additional metadata in JSON';
COMMENT ON COLUMN equipment.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'equipment';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'equipment';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'equipment'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'equipment'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'equipment';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('equipment_category_enum', 'equipment_status_enum');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 014_create_equipment.sql COMPLETED';
    RAISE NOTICE 'Equipment table exists: %', table_exists;
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