-- ============================================
-- MIGRATION: 007_create_inventory.sql
-- DESCRIPTION: Create inventory table with complete stock management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: suppliers table (future), users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create inventory_category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_category_enum') THEN
        CREATE TYPE inventory_category_enum AS ENUM (
            'tablet',
            'capsule',
            'syrup',
            'injection',
            'ointment',
            'cream',
            'drops',
            'inhaler',
            'suppository',
            'vaccine',
            'surgical',
            'consumable',
            'equipment',
            'other'
        );
        RAISE NOTICE 'Created inventory_category_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE INVENTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS inventory (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200),
    
    -- ========================================
    -- CLASSIFICATION
    -- ========================================
    category inventory_category_enum NOT NULL,
    manufacturer VARCHAR(200),
    brand_name VARCHAR(200),
    
    -- ========================================
    -- SUPPLIER
    -- ========================================
    supplier_id UUID,
    supplier_sku VARCHAR(100),
    
    -- ========================================
    -- BATCH TRACKING
    -- ========================================
    batch_number VARCHAR(100) NOT NULL,
    batch_id VARCHAR(50),
    expiry_date DATE NOT NULL,
    manufacturing_date DATE,
    received_date DATE DEFAULT CURRENT_DATE,
    
    -- ========================================
    -- STOCK LEVELS
    -- ========================================
    quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    reorder_level INTEGER NOT NULL,
    minimum_stock INTEGER NOT NULL,
    maximum_stock INTEGER NOT NULL,
    safety_stock INTEGER DEFAULT 0,
    
    -- ========================================
    -- PRICING
    -- ========================================
    unit_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    mrp DECIMAL(10,2),
    gst_percentage DECIMAL(5,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_allowed BOOLEAN DEFAULT TRUE,
    
    -- ========================================
    -- LOCATION
    -- ========================================
    location VARCHAR(100) NOT NULL,
    zone VARCHAR(50),
    rack_number VARCHAR(50),
    shelf_number VARCHAR(50),
    bin_number VARCHAR(50),
    
    -- ========================================
    -- STATUS
    -- ========================================
    is_active BOOLEAN DEFAULT TRUE,
    requires_prescription BOOLEAN DEFAULT FALSE,
    is_narcotic BOOLEAN DEFAULT FALSE,
    is_refrigerated BOOLEAN DEFAULT FALSE,
    is_hazardous BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- STORAGE CONDITIONS
    -- ========================================
    storage_conditions TEXT,
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    humidity_min DECIMAL(5,2),
    humidity_max DECIMAL(5,2),
    light_sensitive BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- AUDIT
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_checked TIMESTAMP,
    checked_by UUID,
    last_ordered TIMESTAMP,
    last_sold TIMESTAMP,
    
    -- ========================================
    -- SOFT DELETE
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- METADATA
    -- ========================================
    notes TEXT,
    metadata JSONB,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_inventory_supplier FOREIGN KEY (supplier_id) 
        REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_checked_by FOREIGN KEY (checked_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Unique constraints
    CONSTRAINT unique_batch_expiry UNIQUE (batch_number, expiry_date),
    
    -- Check constraints
    CONSTRAINT check_quantity CHECK (quantity >= 0),
    CONSTRAINT check_reserved CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
    CONSTRAINT check_prices CHECK (selling_price <= COALESCE(mrp, selling_price)),
    CONSTRAINT check_margin CHECK (selling_price <= unit_price * 1.5),
    CONSTRAINT check_stock_levels CHECK (minimum_stock <= reorder_level AND reorder_level <= maximum_stock),
    CONSTRAINT check_safety_stock CHECK (safety_stock >= 0 AND safety_stock <= minimum_stock),
    CONSTRAINT check_dates CHECK (expiry_date > COALESCE(manufacturing_date, expiry_date - 365)),
    CONSTRAINT check_temperature CHECK (temperature_min <= temperature_max),
    CONSTRAINT check_humidity CHECK (humidity_min <= humidity_max)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core search indexes
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_name ON inventory(medicine_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_generic_name ON inventory(generic_name) WHERE generic_name IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category) WHERE is_deleted = FALSE;

-- Batch tracking indexes
CREATE INDEX IF NOT EXISTS idx_inventory_batch_number ON inventory(batch_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date) WHERE is_deleted = FALSE;

-- Supplier indexes
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_id ON inventory(supplier_id) WHERE supplier_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_sku ON inventory(supplier_sku) WHERE supplier_sku IS NOT NULL AND is_deleted = FALSE;

-- Stock level indexes
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_reorder ON inventory(reorder_level) WHERE quantity <= reorder_level AND is_deleted = FALSE;

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_zone ON inventory(zone) WHERE zone IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_rack ON inventory(rack_number) WHERE rack_number IS NOT NULL AND is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory(is_active) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_prescription ON inventory(requires_prescription) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_narcotic ON inventory(is_narcotic) WHERE is_narcotic = TRUE AND is_deleted = FALSE;

-- Storage condition indexes
CREATE INDEX IF NOT EXISTS idx_inventory_refrigerated ON inventory(is_refrigerated) WHERE is_refrigerated = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_hazardous ON inventory(is_hazardous) WHERE is_hazardous = TRUE AND is_deleted = FALSE;

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_inventory_last_checked ON inventory(last_checked) WHERE last_checked IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_checked_by ON inventory(checked_by) WHERE checked_by IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_inventory_deleted ON inventory(is_deleted, deleted_at);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_inventory_metadata ON inventory USING gin(metadata);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_updated_at') THEN
        CREATE TRIGGER update_inventory_updated_at
            BEFORE UPDATE ON inventory
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_inventory_updated_at';
    END IF;
END $$;

-- Function to check expiry and update status
CREATE OR REPLACE FUNCTION check_inventory_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-deactivate expired items
    IF NEW.expiry_date < CURRENT_DATE THEN
        NEW.is_active = FALSE;
        NEW.notes = COALESCE(NEW.notes || ' ', '') || 'Auto-deactivated due to expiry on ' || NEW.expiry_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for expiry check
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_inventory_expiry_trigger') THEN
        CREATE TRIGGER check_inventory_expiry_trigger
            BEFORE INSERT OR UPDATE OF expiry_date ON inventory
            FOR EACH ROW
            EXECUTE FUNCTION check_inventory_expiry();
        RAISE NOTICE 'Created trigger check_inventory_expiry_trigger';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE inventory IS 'Complete inventory management for medicines and supplies';
COMMENT ON COLUMN inventory.id IS 'Primary key - UUID';
COMMENT ON COLUMN inventory.medicine_name IS 'Medicine/brand name';
COMMENT ON COLUMN inventory.generic_name IS 'Generic/scientific name';
COMMENT ON COLUMN inventory.category IS 'Product category';
COMMENT ON COLUMN inventory.manufacturer IS 'Manufacturer name';
COMMENT ON COLUMN inventory.brand_name IS 'Specific brand name';
COMMENT ON COLUMN inventory.supplier_id IS 'Foreign key to suppliers table';
COMMENT ON COLUMN inventory.supplier_sku IS 'Supplier SKU code';
COMMENT ON COLUMN inventory.batch_number IS 'Batch/Lot number';
COMMENT ON COLUMN inventory.batch_id IS 'Internal batch ID';
COMMENT ON COLUMN inventory.expiry_date IS 'Expiry date';
COMMENT ON COLUMN inventory.manufacturing_date IS 'Manufacturing date';
COMMENT ON COLUMN inventory.received_date IS 'Date received';
COMMENT ON COLUMN inventory.quantity IS 'Current quantity in stock';
COMMENT ON COLUMN inventory.reserved_quantity IS 'Quantity reserved for orders';
COMMENT ON COLUMN inventory.available_quantity IS 'Available quantity (quantity - reserved)';
COMMENT ON COLUMN inventory.reorder_level IS 'Level at which to reorder';
COMMENT ON COLUMN inventory.minimum_stock IS 'Minimum stock level';
COMMENT ON COLUMN inventory.maximum_stock IS 'Maximum stock level';
COMMENT ON COLUMN inventory.safety_stock IS 'Emergency safety stock';
COMMENT ON COLUMN inventory.unit_price IS 'Purchase price per unit';
COMMENT ON COLUMN inventory.selling_price IS 'Selling price per unit';
COMMENT ON COLUMN inventory.mrp IS 'Maximum Retail Price';
COMMENT ON COLUMN inventory.gst_percentage IS 'GST percentage';
COMMENT ON COLUMN inventory.discount_percentage IS 'Maximum discount allowed';
COMMENT ON COLUMN inventory.discount_allowed IS 'Whether discount is allowed';
COMMENT ON COLUMN inventory.location IS 'Primary storage location';
COMMENT ON COLUMN inventory.zone IS 'Storage zone';
COMMENT ON COLUMN inventory.rack_number IS 'Rack number';
COMMENT ON COLUMN inventory.shelf_number IS 'Shelf number';
COMMENT ON COLUMN inventory.bin_number IS 'Bin number';
COMMENT ON COLUMN inventory.is_active IS 'Whether item is active';
COMMENT ON COLUMN inventory.requires_prescription IS 'Whether prescription required';
COMMENT ON COLUMN inventory.is_narcotic IS 'Whether controlled substance';
COMMENT ON COLUMN inventory.is_refrigerated IS 'Whether requires refrigeration';
COMMENT ON COLUMN inventory.is_hazardous IS 'Whether hazardous material';
COMMENT ON COLUMN inventory.storage_conditions IS 'Special storage instructions';
COMMENT ON COLUMN inventory.temperature_min IS 'Minimum temperature (Celsius)';
COMMENT ON COLUMN inventory.temperature_max IS 'Maximum temperature (Celsius)';
COMMENT ON COLUMN inventory.humidity_min IS 'Minimum humidity (%)';
COMMENT ON COLUMN inventory.humidity_max IS 'Maximum humidity (%)';
COMMENT ON COLUMN inventory.light_sensitive IS 'Whether light sensitive';
COMMENT ON COLUMN inventory.last_checked IS 'Last physical verification';
COMMENT ON COLUMN inventory.checked_by IS 'User who last checked';
COMMENT ON COLUMN inventory.last_ordered IS 'Last purchase order date';
COMMENT ON COLUMN inventory.last_sold IS 'Last sale date';
COMMENT ON COLUMN inventory.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN inventory.notes IS 'Additional notes';
COMMENT ON COLUMN inventory.metadata IS 'Additional flexible data in JSON';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'inventory';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'inventory';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'inventory'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'inventory'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'inventory';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname = 'inventory_category_enum';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 007_create_inventory.sql COMPLETED';
    RAISE NOTICE 'Inventory table exists: %', table_exists;
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