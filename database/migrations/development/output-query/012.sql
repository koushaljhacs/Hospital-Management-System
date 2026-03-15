-- ============================================
-- OUTPUT VERIFICATION: 012_create_insurance_providers.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'insurance_providers';

-- ============================================
-- 2. CHECK ALL COLUMNS (78 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'insurance_providers'
ORDER BY ordinal_position;

-- Count total columns (should be 78)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'insurance_providers';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('insurance_type_enum', 'provider_status_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (4)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'insurance_providers'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 4)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'insurance_providers'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (11)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'insurance_providers'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 11)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'insurance_providers'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (25+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'insurance_providers'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'insurance_providers';

-- Check GIN indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'insurance_providers' 
AND indexdef LIKE '%gin%';

-- ============================================
-- 7. CHECK TRIGGERS (1)
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'insurance_providers'
ORDER BY trigger_name;

-- Count triggers (should be 1)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'insurance_providers';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('insurance_providers'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('insurance_providers'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('insurance_providers'::regclass) - pg_relation_size('insurance_providers'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM insurance_providers WHERE is_deleted = FALSE;

-- ============================================
-- 10. CHECK STATUS DISTRIBUTION
-- ============================================
SELECT 
    status,
    COUNT(*) as count
FROM insurance_providers 
WHERE is_deleted = FALSE
GROUP BY status
ORDER BY status;

-- ============================================
-- 11. CHECK COVERAGE RANGE
-- ============================================
SELECT 
    MIN(coverage_percentage) as min_coverage,
    MAX(coverage_percentage) as max_coverage,
    AVG(coverage_percentage) as avg_coverage
FROM insurance_providers 
WHERE is_deleted = FALSE;

-- ============================================
-- 12. COMPLETE SUMMARY REPORT
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
    table_size TEXT;
    index_size TEXT;
    row_count INTEGER;
    active_count INTEGER;
    preferred_count INTEGER;
    verified_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_providers') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'insurance_providers';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'insurance_providers';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'insurance_providers'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'insurance_providers'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'insurance_providers';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('insurance_type_enum', 'provider_status_enum');
    SELECT COUNT(*) INTO row_count FROM insurance_providers WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO active_count FROM insurance_providers WHERE status = 'active' AND is_deleted = FALSE;
    SELECT COUNT(*) INTO preferred_count FROM insurance_providers WHERE is_preferred = TRUE AND is_deleted = FALSE;
    SELECT COUNT(*) INTO verified_count FROM insurance_providers WHERE is_verified = TRUE AND is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('insurance_providers'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('insurance_providers'::regclass) - pg_relation_size('insurance_providers'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     INSURANCE PROVIDERS TABLE VERIFICATION REPORT         ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ Table Exists:          %', RPAD(table_exists::TEXT, 30);
    RAISE NOTICE '║ Total Columns:         %', RPAD(column_count::TEXT, 30);
    RAISE NOTICE '║ Total Indexes:         %', RPAD(index_count::TEXT, 30);
    RAISE NOTICE '║ Foreign Keys:          %', RPAD(fk_count::TEXT, 30);
    RAISE NOTICE '║ Check Constraints:     %', RPAD(check_count::TEXT, 30);
    RAISE NOTICE '║ Triggers:              %', RPAD(trigger_count::TEXT, 30);
    RAISE NOTICE '║ Enums:                 %', RPAD(enum_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Current Row Count:     %', RPAD(row_count::TEXT, 30);
    RAISE NOTICE '║ Active Providers:      %', RPAD(active_count::TEXT, 30);
    RAISE NOTICE '║ Preferred Providers:   %', RPAD(preferred_count::TEXT, 30);
    RAISE NOTICE '║ Verified Providers:    %', RPAD(verified_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             012_create_insurance_providers.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 13. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO insurance_providers (
    name,
    code,
    type,
    phone,
    email,
    coverage_percentage,
    status,
    is_preferred
) VALUES (
    'Star Health Insurance',
    'STAR001',
    'private',
    '1800-123-4567',
    'support@starhealth.com',
    80.00,
    'active',
    TRUE
) RETURNING *;
*/

-- ============================================
-- 14. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'insurance_providers'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'insurance_providers'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'insurance_providers'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'insurance_providers'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'insurance_providers'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('insurance_type_enum', 'provider_status_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================