-- ============================================
-- VERIFICATION QUERIES FOR patients TABLE
-- RUN IN PGADMIN QUERY TOOL
-- ============================================

-- ============================================
-- 1. BASIC TABLE CHECK
-- ============================================

-- Check if table exists
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_name = 'patients';

-- ============================================
-- 2. CHECK ALL COLUMNS
-- ============================================

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- ============================================
-- 3. CHECK ENUMS
-- ============================================

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname IN ('gender', 'blood_group', 'marital_status')
ORDER BY t.typname, e.enumsortorder;

-- ============================================
-- 4. CHECK CONSTRAINTS
-- ============================================

SELECT 
    conname as constraint_name,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        WHEN 'u' THEN 'UNIQUE'
        ELSE contype
    END as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'patients'::regclass
ORDER BY contype;

-- ============================================
-- 5. CHECK INDEXES
-- ============================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'patients'
ORDER BY indexname;

-- Count indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'patients';

-- ============================================
-- 6. CHECK TRIGGERS
-- ============================================

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'patients';

-- ============================================
-- 7. CHECK COMMENTS
-- ============================================

-- Table comment
SELECT 
    obj_description('patients'::regclass, 'pg_class') as table_comment;

-- Column comments (first 10)
SELECT 
    a.attname as column_name,
    col_description(a.attrelid, a.attnum) as comment
FROM pg_attribute a
WHERE a.attrelid = 'patients'::regclass
AND a.attnum > 0
AND NOT a.attisdropped
AND col_description(a.attrelid, a.attnum) IS NOT NULL
ORDER BY a.attnum
LIMIT 10;

-- ============================================
-- 8. CHECK TABLE STRUCTURE (Quick Overview)
-- ============================================

SELECT 
    'Patients Table' as description,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'patients';

-- ============================================
-- 9. FINAL SUMMARY REPORT
-- ============================================

DO $$
DECLARE
    table_exists TEXT;
    total_columns INTEGER;
    total_indexes INTEGER;
    total_constraints INTEGER;
    total_triggers INTEGER;
    total_enums INTEGER;
BEGIN
    -- Table exists?
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'patients'
    )::TEXT INTO table_exists;
    
    -- Column count
    SELECT COUNT(*) INTO total_columns
    FROM information_schema.columns WHERE table_name = 'patients';
    
    -- Index count
    SELECT COUNT(*) INTO total_indexes
    FROM pg_indexes WHERE tablename = 'patients';
    
    -- Constraint count
    SELECT COUNT(*) INTO total_constraints
    FROM pg_constraint WHERE conrelid = 'patients'::regclass;
    
    -- Trigger count
    SELECT COUNT(*) INTO total_triggers
    FROM information_schema.triggers WHERE event_object_table = 'patients';
    
    -- Enum count
    SELECT COUNT(*) INTO total_enums
    FROM pg_type WHERE typname IN ('gender', 'blood_group', 'marital_status');
    
    -- Final report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════╗';
    RAISE NOTICE '║     PATIENTS TABLE VERIFICATION REPORT    ║';
    RAISE NOTICE '╠════════════════════════════════════════════╣';
    RAISE NOTICE '║ Table exists:        %', RPAD(table_exists, 15);
    RAISE NOTICE '║ Total columns:       %', RPAD(total_columns::TEXT, 15);
    RAISE NOTICE '║ Total indexes:       %', RPAD(total_indexes::TEXT, 15);
    RAISE NOTICE '║ Total constraints:   %', RPAD(total_constraints::TEXT, 15);
    RAISE NOTICE '║ Total triggers:      %', RPAD(total_triggers::TEXT, 15);
    RAISE NOTICE '║ Total enums:         %', RPAD(total_enums::TEXT, 15);
    RAISE NOTICE '╚════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 10. SAMPLE DATA INSERT (Optional Test)
-- ============================================

-- First check if there are any users
SELECT id, username, email FROM users LIMIT 5;

-- Insert a test patient (replace with actual user_id from above)
-- INSERT INTO patients (
--     user_id,
--     first_name,
--     last_name,
--     date_of_birth,
--     gender,
--     blood_group,
--     phone,
--     email,
--     emergency_contact_name,
--     emergency_contact_phone
-- ) VALUES (
--     'your-user-id-here',  -- Replace with actual UUID from users table
--     'Test',
--     'Patient',
--     '1990-01-01',
--     'male',
--     'O+',
--     '+91-9876543210',
--     'test.patient@example.com',
--     'Emergency Contact',
--     '+91-9876543211'
-- ) RETURNING *;

-- ============================================
-- END OF VERIFICATION QUERIES
-- ============================================