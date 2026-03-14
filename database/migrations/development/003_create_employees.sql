-- ============================================
-- MIGRATION: 003_create_employees.sql
-- DESCRIPTION: Create employees table for staff management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: 001_create_users.sql, 002_create_patients.sql
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create department enum (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department') THEN
        CREATE TYPE department AS ENUM (
            'cardiology',
            'neurology',
            'orthopedics',
            'pediatrics',
            'radiology',
            'oncology',
            'emergency',
            'pharmacy',
            'laboratory',
            'administration',
            'hr',
            'it',
            'billing',
            'maintenance'
        );
        RAISE NOTICE 'Created department enum type';
    ELSE
        RAISE NOTICE 'department enum type already exists, skipping...';
    END IF;
END $$;

-- Create employment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
        CREATE TYPE employment_status AS ENUM (
            'active',
            'inactive',
            'on_leave',
            'terminated',
            'retired'
        );
        RAISE NOTICE 'Created employment_status enum type';
    ELSE
        RAISE NOTICE 'employment_status enum type already exists, skipping...';
    END IF;
END $$;

-- Create shift_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
        CREATE TYPE shift_type AS ENUM (
            'morning',
            'evening',
            'night',
            'general'
        );
        RAISE NOTICE 'Created shift_type enum type';
    ELSE
        RAISE NOTICE 'shift_type enum type already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE DEPARTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    floor INTEGER,
    head_of_department UUID,  -- Will reference employees later
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for departments
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

COMMENT ON TABLE departments IS 'Hospital departments';
COMMENT ON COLUMN departments.name IS 'Department name';
COMMENT ON COLUMN departments.code IS 'Department code (unique)';
COMMENT ON COLUMN departments.floor IS 'Floor number where department is located';

-- ============================================
-- PART 3: CREATE EMPLOYEES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key to users table
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Foreign Key to departments
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Employee Identification
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    specialization VARCHAR(200),
    qualification VARCHAR(200),
    license_number VARCHAR(100),
    
    -- Employment Details
    joining_date DATE NOT NULL,
    employment_status employment_status DEFAULT 'active',
    shift_type shift_type DEFAULT 'general',
    shift_timing JSONB,  -- Flexible shift timing storage
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    
    -- Address
    address TEXT,
    
    -- Bank Details (encrypted in application)
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    bank_name VARCHAR(100),
    
    -- Documents
    profile_photo TEXT,
    resume_url TEXT,
    documents JSONB,  -- Store other document references
    
    -- Salary Information
    salary DECIMAL(10,2),
    payment_frequency VARCHAR(20) DEFAULT 'monthly',
    
    -- Leave and Attendance
    leave_balance INTEGER DEFAULT 0,
    total_leaves INTEGER DEFAULT 0,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES users(id),
    
    -- Audit Columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_employees_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
    
    -- Check constraints
    CONSTRAINT check_employee_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT check_employee_phone CHECK (phone IS NULL OR phone ~ '^[0-9+\-\s]{10,20}$'),
    CONSTRAINT check_joining_date CHECK (joining_date <= CURRENT_DATE)
);

-- Create indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_employment_status ON employees(employment_status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_joining_date ON employees(joining_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(last_name, first_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_employees_deleted ON employees(is_deleted, deleted_at);

-- ============================================
-- PART 4: UPDATE DEPARTMENT HEAD (after employees table exists)
-- ============================================

-- Add foreign key constraint for head_of_department (safe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_departments_head'
    ) THEN
        ALTER TABLE departments 
        ADD CONSTRAINT fk_departments_head 
        FOREIGN KEY (head_of_department) 
        REFERENCES employees(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added head_of_department foreign key';
    END IF;
END $$;

-- ============================================
-- PART 5: TRIGGER FOR UPDATED_AT
-- ============================================

-- Trigger for departments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_departments_updated_at') THEN
        CREATE TRIGGER update_departments_updated_at
            BEFORE UPDATE ON departments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_departments_updated_at';
    END IF;
END $$;

-- Trigger for employees
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_employees_updated_at') THEN
        CREATE TRIGGER update_employees_updated_at
            BEFORE UPDATE ON employees
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_employees_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 6: COMMENTS
-- ============================================

COMMENT ON TABLE employees IS 'Hospital employees and staff information';
COMMENT ON COLUMN employees.id IS 'Primary key - UUID';
COMMENT ON COLUMN employees.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN employees.department_id IS 'Department where employee works';
COMMENT ON COLUMN employees.employee_id IS 'Unique employee ID';
COMMENT ON COLUMN employees.first_name IS 'Employee first name';
COMMENT ON COLUMN employees.last_name IS 'Employee last name';
COMMENT ON COLUMN employees.designation IS 'Job designation/title';
COMMENT ON COLUMN employees.specialization IS 'Area of specialization';
COMMENT ON COLUMN employees.qualification IS 'Educational qualifications';
COMMENT ON COLUMN employees.license_number IS 'Professional license number';
COMMENT ON COLUMN employees.joining_date IS 'Date of joining';
COMMENT ON COLUMN employees.employment_status IS 'Current employment status';
COMMENT ON COLUMN employees.shift_type IS 'Type of shift (morning/evening/night)';
COMMENT ON COLUMN employees.shift_timing IS 'Flexible shift timing in JSON';
COMMENT ON COLUMN employees.salary IS 'Monthly/Annual salary';
COMMENT ON COLUMN employees.leave_balance IS 'Available leave days';
COMMENT ON COLUMN employees.is_deleted IS 'Soft delete flag';

-- ============================================
-- PART 7: VERIFICATION
-- ============================================

DO $$
DECLARE
    departments_exists BOOLEAN;
    employees_exists BOOLEAN;
    dept_indexes INTEGER;
    emp_indexes INTEGER;
    enum_count INTEGER;
BEGIN
    -- Check tables
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') INTO departments_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') INTO employees_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO dept_indexes FROM pg_indexes WHERE tablename = 'departments';
    SELECT COUNT(*) INTO emp_indexes FROM pg_indexes WHERE tablename = 'employees';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('department', 'employment_status', 'shift_type');
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 003_create_employees.sql COMPLETED';
    RAISE NOTICE 'Departments table exists: %', departments_exists;
    RAISE NOTICE 'Employees table exists: %', employees_exists;
    RAISE NOTICE 'Departments indexes: %', dept_indexes;
    RAISE NOTICE 'Employees indexes: %', emp_indexes;
    RAISE NOTICE 'New enums created: %', enum_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION
-- ============================================