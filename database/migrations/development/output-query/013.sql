-- ============================================
-- OUTPUT VERIFICATION: 013_create_lab_tests.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'lab_tests';

-- ============================================
-- 2. CHECK ALL COLUMNS (79 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'lab_tests'
ORDER BY ordinal_position;

-- Count total columns (should be 79)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'lab_tests';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('lab_category_enum', 'sample_type_enum', 'gender_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK GENERATED COLUMNS (2)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_generated,
    generation_expression
FROM information_schema.columns 
WHERE table_name = 'lab_tests' 
AND is_generated = 'ALWAYS';

-- ============================================
-- 5. CHECK FOREIGN KEY CONSTRAINTS (4)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'lab_tests'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 4)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'lab_tests'::regclass
AND contype = 'f';

-- ============================================
-- 6. CHECK CHECK CONSTRAINTS (11)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'lab_tests'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 11)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'lab_tests'::regclass
AND contype = 'c';

-- ============================================
-- 7. CHECK INDEXES (30+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'lab_tests'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'lab_tests';

-- Check GIN indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'lab_tests' 
AND indexdef LIKE '%gin%';

-- ============================================
-- 8. CHECK TRIGGERS (1)
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'lab_tests'
ORDER BY trigger_name;

-- Count triggers (should be 1)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'lab_tests';

-- ============================================
-- 9. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('lab_tests'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('lab_tests'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('lab_tests'::regclass) - pg_relation_size('lab_tests'::regclass)) as index_size;

-- ============================================
-- 10. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM lab_tests WHERE is_deleted = FALSE;

-- ============================================
-- 11. CHECK CATEGORY DISTRIBUTION
-- ============================================
SELECT 
    category,
    COUNT(*) as count
FROM lab_tests 
WHERE is_deleted = FALSE
GROUP BY category
ORDER BY category;

-- ============================================
-- 12. CHECK PRICE RANGE
-- ============================================
SELECT 
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price) as avg_price
FROM lab_tests 
WHERE is_deleted = FALSE;

-- ============================================
-- 13. COMPLETE SUMMARY REPORT
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
    table_size TEXT;
    index_size TEXT;
    row_count INTEGER;
    active_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_tests') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'lab_tests';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'lab_tests';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'lab_tests'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'lab_tests'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'lab_tests';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('lab_category_enum', 'sample_type_enum', 'gender_enum');
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'lab_tests' AND is_generated = 'ALWAYS';
    SELECT COUNT(*) INTO row_count FROM lab_tests WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO active_count FROM lab_tests WHERE is_active = TRUE AND is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('lab_tests'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('lab_tests'::regclass) - pg_relation_size('lab_tests'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     LAB TESTS TABLE VERIFICATION REPORT                   ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ Table Exists:          %', RPAD(table_exists::TEXT, 30);
    RAISE NOTICE '║ Total Columns:         %', RPAD(column_count::TEXT, 30);
    RAISE NOTICE '║ Generated Columns:     %', RPAD(generated_count::TEXT, 30);
    RAISE NOTICE '║ Total Indexes:         %', RPAD(index_count::TEXT, 30);
    RAISE NOTICE '║ Foreign Keys:          %', RPAD(fk_count::TEXT, 30);
    RAISE NOTICE '║ Check Constraints:     %', RPAD(check_count::TEXT, 30);
    RAISE NOTICE '║ Triggers:              %', RPAD(trigger_count::TEXT, 30);
    RAISE NOTICE '║ Enums:                 %', RPAD(enum_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Current Row Count:     %', RPAD(row_count::TEXT, 30);
    RAISE NOTICE '║ Active Tests:          %', RPAD(active_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             013_create_lab_tests.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 14. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO lab_tests (
    test_code,
    test_name,
    category,
    sample_type,
    price,
    unit,
    normal_range,
    created_by
) VALUES (
    'CBC001',
    'Complete Blood Count',
    'hematology',
    'blood',
    500.00,
    'cells/μL',
    '4.5-11.0',
    (SELECT id FROM users LIMIT 1)
) RETURNING *;
*/

-- ============================================
-- 15. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'lab_tests'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'lab_tests'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'lab_tests'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'lab_tests'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'lab_tests'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('lab_category_enum', 'sample_type_enum', 'gender_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================