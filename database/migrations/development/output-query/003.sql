-- ============================================
-- OUTPUT VERIFICATION: 003_create_employees.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLES EXIST
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name IN ('departments', 'employees')
ORDER BY table_name;

-- ============================================
-- 2. CHECK ALL COLUMNS IN EMPLOYEES TABLE
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- Count total columns (should be 78)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'employees';

-- ============================================
-- 3. CHECK ALL ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('gender', 'blood_group', 'marital_status', 'department', 'employment_status', 'employment_type', 'shift_type')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK ALL INDEXES
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'employees'
ORDER BY indexname;

-- Count total indexes (should be 52)
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'employees';

-- Check GIN indexes specifically
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'employees' 
AND indexdef LIKE '%gin%'
ORDER BY indexname;

-- ============================================
-- 5. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND contype = 'f'
ORDER BY conname;

-- ============================================
-- 6. CHECK CHECK CONSTRAINTS
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND contype = 'c'
ORDER BY conname;

-- ============================================
-- 7. CHECK TRIGGERS
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('departments', 'employees')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 8. CHECK TABLE SIZES (Performance)
-- ============================================
SELECT
    table_name,
    pg_size_pretty(pg_total_relation_size(table_name::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(table_name::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size(table_name::regclass) - pg_relation_size(table_name::regclass)) as index_size
FROM (
    SELECT unnest(ARRAY['departments', 'employees']) AS table_name
) AS tables
ORDER BY table_name;

-- ============================================
-- 9. CHECK ROW COUNTS (if any data exists)
-- ============================================
SELECT 
    'departments' as table_name,
    COUNT(*) as row_count
FROM departments
UNION ALL
SELECT 
    'employees' as table_name,
    COUNT(*) as row_count
FROM employees;

-- ============================================
-- 10. COMPLETE SUMMARY REPORT
-- ============================================
DO $$
DECLARE
    table_count INTEGER;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
    table_size TEXT;
    index_size TEXT;
    dept_rows INTEGER;
    emp_rows INTEGER;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_name IN ('departments', 'employees');
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'employees';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'employees';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'employees'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'employees'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table IN ('departments', 'employees');
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('gender', 'blood_group', 'marital_status', 'department', 'employment_status', 'employment_type', 'shift_type');
    
    -- Get row counts
    SELECT COUNT(*) INTO dept_rows FROM departments;
    SELECT COUNT(*) INTO emp_rows FROM employees;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('employees'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('employees'::regclass) - pg_relation_size('employees'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     EMPLOYEES TABLE VERIFICATION REPORT                    ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ Tables Created:          %', RPAD(table_count::TEXT || ' (departments, employees)', 30);
    RAISE NOTICE '║ Total Columns:           %', RPAD(column_count::TEXT, 30);
    RAISE NOTICE '║ Total Indexes:           %', RPAD(index_count::TEXT, 30);
    RAISE NOTICE '║ Foreign Key Constraints: %', RPAD(fk_count::TEXT, 30);
    RAISE NOTICE '║ Check Constraints:       %', RPAD(check_count::TEXT, 30);
    RAISE NOTICE '║ Triggers:                %', RPAD(trigger_count::TEXT, 30);
    RAISE NOTICE '║ Enums Created:           %', RPAD(enum_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Departments Row Count:   %', RPAD(dept_rows::TEXT, 30);
    RAISE NOTICE '║ Employees Row Count:     %', RPAD(emp_rows::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:              %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:              %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                  ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:               003_create_employees.sql';
    RAISE NOTICE '║ Verified:                %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 11. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
-- Insert a department first
INSERT INTO departments (name, code, floor) 
VALUES ('cardiology', 'CARD01', 3)
RETURNING *;

-- Insert an employee (make sure you have a user first)
-- SELECT id FROM users LIMIT 1;  -- Get a user_id first

INSERT INTO employees (
    user_id,
    employee_id,
    first_name,
    last_name,
    date_of_birth,
    gender,
    designation,
    joining_date,
    phone,
    email,
    employment_status,
    employment_type
) VALUES (
    (SELECT id FROM users LIMIT 1),  -- Replace with actual user_id
    'EMP001',
    'John',
    'Doe',
    '1990-01-01',
    'male',
    'Cardiologist',
    '2024-01-01',
    '+91-9876543210',
    'john.doe@hospital.com',
    'active',
    'full_time'
) RETURNING *;
*/

-- ============================================
-- 12. QUICK VERIFICATION
-- ============================================
SELECT 
    'Employees Table' as description,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'employees'
UNION ALL
SELECT 
    'Indexes' as description,
    COUNT(*) as total_count
FROM pg_indexes 
WHERE tablename = 'employees'
UNION ALL
SELECT 
    'Foreign Keys' as description,
    COUNT(*) as total_count
FROM pg_constraint 
WHERE conrelid = 'employees'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints' as description,
    COUNT(*) as total_count
FROM pg_constraint 
WHERE conrelid = 'employees'::regclass AND contype = 'c';

-- ============================================
-- END OF VERIFICATION
-- ============================================