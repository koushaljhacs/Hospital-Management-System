
-- ============================================
-- MIGRATION: 020_create_shifts.sql
-- DESCRIPTION: Create shifts table for comprehensive shift management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: departments table, users table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create shift_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type_enum') THEN
        CREATE TYPE shift_type_enum AS ENUM (
            'morning',
            'evening',
            'night',
            'general',
            'split',
            'on_call',
            'weekend'
        );
        RAISE NOTICE 'Created shift_type_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE SHIFTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS shifts (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_code VARCHAR(50) UNIQUE NOT NULL,
    shift_name VARCHAR(100) NOT NULL,
    shift_type shift_type_enum NOT NULL,
    
    -- ========================================
    -- TIMING
    -- ========================================
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    total_hours DECIMAL(4,2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 - 
        COALESCE(EXTRACT(EPOCH FROM (break_end - break_start)) / 3600, 0)
    ) STORED,
    
    -- ========================================
    -- WEEKLY SCHEDULE
    -- ========================================
    monday BOOLEAN DEFAULT FALSE,
    tuesday BOOLEAN DEFAULT FALSE,
    wednesday BOOLEAN DEFAULT FALSE,
    thursday BOOLEAN DEFAULT FALSE,
    friday BOOLEAN DEFAULT FALSE,
    saturday BOOLEAN DEFAULT FALSE,
    sunday BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- DEPARTMENT & LOCATION
    -- ========================================
    department_id UUID,
    location VARCHAR(200),
    
    -- ========================================
    -- STAFFING
    -- ========================================
    min_staff_required INTEGER DEFAULT 1,
    max_staff_allowed INTEGER,
    current_staff_count INTEGER DEFAULT 0,
    allowed_roles UUID[],
    
    -- ========================================
    -- RULES & POLICIES
    -- ========================================
    overtime_allowed BOOLEAN DEFAULT FALSE,
    overtime_rate DECIMAL(3,2) DEFAULT 1.5,
    late_grace_period INTEGER DEFAULT 15,
    early_departure_grace INTEGER DEFAULT 15,
    min_rest_between_shifts INTEGER DEFAULT 8,
    
    -- ========================================
    -- LEAVE & ABSENCE
    -- ========================================
    leave_quota_per_month INTEGER,
    sick_leave_quota INTEGER,
    casual_leave_quota INTEGER,
    paid_leave_allowed BOOLEAN DEFAULT TRUE,
    
    -- ========================================
    -- PAYMENT
    -- ========================================
    base_rate DECIMAL(10,2),
    night_differential DECIMAL(3,2) DEFAULT 0,
    weekend_rate DECIMAL(3,2) DEFAULT 1,
    holiday_rate DECIMAL(3,2) DEFAULT 2,
    
    -- ========================================
    -- STATUS
    -- ========================================
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE,
    effective_to DATE,
    notes TEXT,
    
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
    CONSTRAINT fk_shifts_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_shifts_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_shifts_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_shifts_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_times CHECK (end_time > start_time),
    CONSTRAINT check_break CHECK (break_end > break_start),
    CONSTRAINT check_staff_count CHECK (min_staff_required <= max_staff_allowed),
    CONSTRAINT check_rates CHECK (base_rate >= 0),
    CONSTRAINT check_dates CHECK (effective_to >= effective_from),
    CONSTRAINT check_overtime_rate CHECK (overtime_rate >= 1),
    CONSTRAINT check_grace_periods CHECK (late_grace_period >= 0 AND early_departure_grace >= 0),
    CONSTRAINT check_rest_hours CHECK (min_rest_between_shifts >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_shifts_code ON shifts(shift_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_name ON shifts(shift_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_type ON shifts(shift_type) WHERE is_deleted = FALSE;

-- Timing indexes
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_end_time ON shifts(end_time) WHERE is_deleted = FALSE;

-- Day indexes
CREATE INDEX IF NOT EXISTS idx_shifts_monday ON shifts(monday) WHERE monday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_tuesday ON shifts(tuesday) WHERE tuesday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_wednesday ON shifts(wednesday) WHERE wednesday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_thursday ON shifts(thursday) WHERE thursday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_friday ON shifts(friday) WHERE friday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_saturday ON shifts(saturday) WHERE saturday = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_sunday ON shifts(sunday) WHERE sunday = TRUE AND is_deleted = FALSE;

-- Department & location indexes
CREATE INDEX IF NOT EXISTS idx_shifts_department ON shifts(department_id) WHERE department_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_location ON shifts(location) WHERE location IS NOT NULL AND is_deleted = FALSE;

-- Staffing indexes
CREATE INDEX IF NOT EXISTS idx_shifts_staff_count ON shifts(current_staff_count) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_min_staff ON shifts(min_staff_required) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_effective_from ON shifts(effective_from) WHERE effective_from IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_effective_to ON shifts(effective_to) WHERE effective_to IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_shifts_deleted ON shifts(is_deleted, deleted_at);

-- GIN indexes for arrays
CREATE INDEX IF NOT EXISTS idx_shifts_allowed_roles ON shifts USING gin(allowed_roles);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shifts_updated_at') THEN
        CREATE TRIGGER update_shifts_updated_at
            BEFORE UPDATE ON shifts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_shifts_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE shifts IS 'Complete shift management system';
COMMENT ON COLUMN shifts.id IS 'Primary key - UUID';
COMMENT ON COLUMN shifts.shift_code IS 'Unique shift code';
COMMENT ON COLUMN shifts.shift_name IS 'Shift name';
COMMENT ON COLUMN shifts.shift_type IS 'Type of shift';
COMMENT ON COLUMN shifts.start_time IS 'Shift start time';
COMMENT ON COLUMN shifts.end_time IS 'Shift end time';
COMMENT ON COLUMN shifts.break_start IS 'Break start time';
COMMENT ON COLUMN shifts.break_end IS 'Break end time';
COMMENT ON COLUMN shifts.total_hours IS 'Total working hours (generated)';
COMMENT ON COLUMN shifts.monday IS 'Shift applies on Monday';
COMMENT ON COLUMN shifts.tuesday IS 'Shift applies on Tuesday';
COMMENT ON COLUMN shifts.wednesday IS 'Shift applies on Wednesday';
COMMENT ON COLUMN shifts.thursday IS 'Shift applies on Thursday';
COMMENT ON COLUMN shifts.friday IS 'Shift applies on Friday';
COMMENT ON COLUMN shifts.saturday IS 'Shift applies on Saturday';
COMMENT ON COLUMN shifts.sunday IS 'Shift applies on Sunday';
COMMENT ON COLUMN shifts.department_id IS 'Department where shift applies';
COMMENT ON COLUMN shifts.location IS 'Location where shift applies';
COMMENT ON COLUMN shifts.min_staff_required IS 'Minimum staff required';
COMMENT ON COLUMN shifts.max_staff_allowed IS 'Maximum staff allowed';
COMMENT ON COLUMN shifts.current_staff_count IS 'Current staff count';
COMMENT ON COLUMN shifts.allowed_roles IS 'Roles allowed for this shift';
COMMENT ON COLUMN shifts.overtime_allowed IS 'Whether overtime is allowed';
COMMENT ON COLUMN shifts.overtime_rate IS 'Overtime rate multiplier';
COMMENT ON COLUMN shifts.late_grace_period IS 'Late grace period in minutes';
COMMENT ON COLUMN shifts.early_departure_grace IS 'Early departure grace period in minutes';
COMMENT ON COLUMN shifts.min_rest_between_shifts IS 'Minimum rest between shifts in hours';
COMMENT ON COLUMN shifts.leave_quota_per_month IS 'Leave quota per month';
COMMENT ON COLUMN shifts.sick_leave_quota IS 'Sick leave quota';
COMMENT ON COLUMN shifts.casual_leave_quota IS 'Casual leave quota';
COMMENT ON COLUMN shifts.paid_leave_allowed IS 'Whether paid leave is allowed';
COMMENT ON COLUMN shifts.base_rate IS 'Base pay rate';
COMMENT ON COLUMN shifts.night_differential IS 'Night shift differential';
COMMENT ON COLUMN shifts.weekend_rate IS 'Weekend rate multiplier';
COMMENT ON COLUMN shifts.holiday_rate IS 'Holiday rate multiplier';
COMMENT ON COLUMN shifts.is_active IS 'Whether shift is active';
COMMENT ON COLUMN shifts.effective_from IS 'Effective from date';
COMMENT ON COLUMN shifts.effective_to IS 'Effective to date';
COMMENT ON COLUMN shifts.notes IS 'Additional notes';
COMMENT ON COLUMN shifts.is_deleted IS 'Soft delete flag';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'shifts';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'shifts';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'shifts'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'shifts'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'shifts';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname = 'shift_type_enum';
    
    -- Count generated columns
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'shifts' AND is_generated = 'ALWAYS';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 020_create_shifts.sql COMPLETED';
    RAISE NOTICE 'Shifts table exists: %', table_exists;
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