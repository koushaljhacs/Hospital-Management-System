-- ============================================
-- MIGRATION: 002_create_patients.sql
-- DESCRIPTION: Create patients table with medical records
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: 001_create_users.sql (users table must exist)
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create gender enum type (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
        CREATE TYPE gender AS ENUM (
            'male', 
            'female', 
            'other',
            'prefer_not_to_say'
        );
        RAISE NOTICE 'Created gender enum type';
    ELSE
        RAISE NOTICE 'gender enum type already exists, skipping...';
    END IF;
END $$;

-- Create blood_group enum type (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_group') THEN
        CREATE TYPE blood_group AS ENUM (
            'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
        );
        RAISE NOTICE 'Created blood_group enum type';
    ELSE
        RAISE NOTICE 'blood_group enum type already exists, skipping...';
    END IF;
END $$;

-- Create marital_status enum type (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marital_status') THEN
        CREATE TYPE marital_status AS ENUM (
            'single', 
            'married', 
            'divorced', 
            'widowed', 
            'other'
        );
        RAISE NOTICE 'Created marital_status enum type';
    ELSE
        RAISE NOTICE 'marital_status enum type already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- PART 2: SAFE TABLE CREATION (IMPROVED)
-- ============================================

-- Create patients table (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
        CREATE TABLE patients (
            -- Primary Key
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Foreign Key to users table - RESTRICT instead of CASCADE for safety
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            
            -- Personal Information
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            date_of_birth DATE NOT NULL,
            gender gender,
            blood_group blood_group,
            marital_status marital_status,
            occupation VARCHAR(100),
            nationality VARCHAR(100),
            preferred_language VARCHAR(50) DEFAULT 'english',
            
            -- Contact Information
            phone VARCHAR(20) UNIQUE,
            alternate_phone VARCHAR(20),
            email VARCHAR(255),
            address TEXT,
            
            -- Registration Details
            registration_date DATE DEFAULT CURRENT_DATE,
            referred_by VARCHAR(100),
            profile_photo TEXT,
            
            -- Emergency Contact
            emergency_contact_name VARCHAR(200) NOT NULL,
            emergency_contact_phone VARCHAR(20) NOT NULL,
            emergency_contact_relation VARCHAR(50),
            
            -- Medical Information
            allergies TEXT,
            medical_conditions TEXT,
            
            -- Insurance Information
            insurance_provider_id UUID,
            insurance_policy VARCHAR(100),
            insurance_expiry DATE,
            
            -- Consent
            consent_form_signed BOOLEAN DEFAULT FALSE,
            consent_form_date DATE,
            
            -- Soft Delete (for data retention - medical records never permanently deleted)
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP,
            deleted_by UUID,
            
            -- Audit Columns
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints
            CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
            CONSTRAINT fk_patients_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
            
            -- Check constraints for data validation
            CONSTRAINT check_emergency_phone CHECK (emergency_contact_phone ~ '^[0-9+\-\s]{10,20}$'),
            CONSTRAINT check_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
            CONSTRAINT check_insurance_expiry CHECK (insurance_expiry IS NULL OR insurance_expiry > CURRENT_DATE),
            CONSTRAINT check_consent_date CHECK (consent_form_date IS NULL OR consent_form_date <= CURRENT_DATE),
            CONSTRAINT check_date_of_birth CHECK (date_of_birth <= CURRENT_DATE)
        );
        RAISE NOTICE 'Created patients table';
        
        -- Create indexes after table creation (partial indexes for performance)
        CREATE INDEX idx_patients_user_id ON patients(user_id) WHERE is_deleted = FALSE;
        CREATE INDEX idx_patients_phone ON patients(phone) WHERE is_deleted = FALSE;
        CREATE INDEX idx_patients_email ON patients(email) WHERE is_deleted = FALSE;
        CREATE INDEX idx_patients_dob ON patients(date_of_birth) WHERE is_deleted = FALSE;
        CREATE INDEX idx_patients_insurance ON patients(insurance_provider_id) WHERE insurance_provider_id IS NOT NULL;
        CREATE INDEX idx_patients_deleted ON patients(is_deleted, deleted_at);
        CREATE INDEX idx_patients_name ON patients(last_name, first_name) WHERE is_deleted = FALSE;
        RAISE NOTICE 'Created indexes on patients table';
        
    ELSE
        RAISE NOTICE 'patients table already exists, skipping creation...';
        
        -- Check and create missing indexes (safe)
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_user_id') THEN
            CREATE INDEX idx_patients_user_id ON patients(user_id) WHERE is_deleted = FALSE;
            RAISE NOTICE 'Created missing index idx_patients_user_id';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_phone') THEN
            CREATE INDEX idx_patients_phone ON patients(phone) WHERE is_deleted = FALSE;
            RAISE NOTICE 'Created missing index idx_patients_phone';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_email') THEN
            CREATE INDEX idx_patients_email ON patients(email) WHERE is_deleted = FALSE;
            RAISE NOTICE 'Created missing index idx_patients_email';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_dob') THEN
            CREATE INDEX idx_patients_dob ON patients(date_of_birth) WHERE is_deleted = FALSE;
            RAISE NOTICE 'Created missing index idx_patients_dob';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_insurance') THEN
            CREATE INDEX idx_patients_insurance ON patients(insurance_provider_id) WHERE insurance_provider_id IS NOT NULL;
            RAISE NOTICE 'Created missing index idx_patients_insurance';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_deleted') THEN
            CREATE INDEX idx_patients_deleted ON patients(is_deleted, deleted_at);
            RAISE NOTICE 'Created missing index idx_patients_deleted';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_name') THEN
            CREATE INDEX idx_patients_name ON patients(last_name, first_name) WHERE is_deleted = FALSE;
            RAISE NOTICE 'Created missing index idx_patients_name';
        END IF;
    END IF;
END $$;

-- ============================================
-- PART 3: TRIGGER FOR UPDATED_AT
-- ============================================

-- Create trigger on patients table (safe - checks if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patients_updated_at') THEN
        CREATE TRIGGER update_patients_updated_at
            BEFORE UPDATE ON patients
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_patients_updated_at';
    ELSE
        RAISE NOTICE 'Trigger update_patients_updated_at already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- PART 4: COMMENTS
-- ============================================

COMMENT ON TABLE patients IS 'Patient medical records and personal information';
COMMENT ON COLUMN patients.id IS 'Primary key - UUID';
COMMENT ON COLUMN patients.user_id IS 'Foreign key to users table (RESTRICT delete)';
COMMENT ON COLUMN patients.first_name IS 'Patient first name';
COMMENT ON COLUMN patients.last_name IS 'Patient last name';
COMMENT ON COLUMN patients.date_of_birth IS 'Date of birth';
COMMENT ON COLUMN patients.gender IS 'Gender (male/female/other/prefer_not_to_say)';
COMMENT ON COLUMN patients.blood_group IS 'Blood group (A+, A-, B+, B-, AB+, AB-, O+, O-, unknown)';
COMMENT ON COLUMN patients.phone IS 'Primary phone number (unique)';
COMMENT ON COLUMN patients.email IS 'Email address';
COMMENT ON COLUMN patients.emergency_contact_name IS 'Emergency contact person name';
COMMENT ON COLUMN patients.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN patients.emergency_contact_relation IS 'Relationship with emergency contact';
COMMENT ON COLUMN patients.allergies IS 'List of allergies (comma separated)';
COMMENT ON COLUMN patients.medical_conditions IS 'Pre-existing medical conditions';
COMMENT ON COLUMN patients.insurance_provider_id IS 'Foreign key to insurance_providers table (future)';
COMMENT ON COLUMN patients.is_deleted IS 'Soft delete flag for data retention';
COMMENT ON COLUMN patients.deleted_at IS 'Timestamp when record was soft deleted';
COMMENT ON COLUMN patients.deleted_by IS 'User who soft deleted the record';

-- ============================================
-- PART 5: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    index_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Check table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'patients'
    ) INTO table_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes WHERE tablename = 'patients';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'patients';
    
    -- Count new enums
    SELECT COUNT(*) INTO enum_count 
    FROM pg_type WHERE typname IN ('gender', 'blood_group', 'marital_status');
    
    -- Count constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints
    WHERE table_name = 'patients';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 002_create_patients.sql COMPLETED';
    RAISE NOTICE 'Patients table exists: %', table_exists;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Total triggers: %', trigger_count;
    RAISE NOTICE 'New enums created: %', enum_count;
    RAISE NOTICE 'Total constraints: %', constraint_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================