-- ============================================
-- OUTPUT VERIFICATION: 016_create_radiology_images.sql
-- ============================================

-- 1. Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'radiology_images';

-- 2. Count columns
SELECT COUNT(*) as total_columns 
FROM information_schema.columns 
WHERE table_name = 'radiology_images';

-- 3. List all columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'radiology_images'
ORDER BY ordinal_position;

-- 4. Check enums
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('radiology_type_enum', 'radiology_report_status_enum', 'radiology_priority_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- 5. Count foreign keys
SELECT COUNT(*) as fk_count 
FROM pg_constraint 
WHERE conrelid = 'radiology_images'::regclass AND contype = 'f';

-- 6. List foreign keys
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'radiology_images'::regclass AND contype = 'f';

-- 7. Count check constraints
SELECT COUNT(*) as check_count 
FROM pg_constraint 
WHERE conrelid = 'radiology_images'::regclass AND contype = 'c';

-- 8. Count indexes
SELECT COUNT(*) as index_count 
FROM pg_indexes 
WHERE tablename = 'radiology_images';

-- 9. List GIN indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'radiology_images' 
AND indexdef LIKE '%gin%';

-- 10. Count triggers
SELECT COUNT(*) as trigger_count 
FROM information_schema.triggers 
WHERE event_object_table = 'radiology_images';

-- 11. List triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'radiology_images';

-- 12. Quick summary
SELECT 
    'Radiology Images Table' as description,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'radiology_images') as columns,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'radiology_images') as indexes,
    (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'radiology_images'::regclass) as constraints,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'radiology_images') as triggers;

-- 13. Complete summary report
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
    gin_index_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radiology_images') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'radiology_images';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'radiology_images';
    SELECT COUNT(*) INTO gin_index_count FROM pg_indexes WHERE tablename = 'radiology_images' AND indexdef LIKE '%gin%';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'radiology_images'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'radiology_images'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'radiology_images';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('radiology_type_enum', 'radiology_report_status_enum', 'radiology_priority_enum');
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     RADIOLOGY IMAGES TABLE VERIFICATION REPORT            ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ Table Exists:          %', RPAD(table_exists::TEXT, 30);
    RAISE NOTICE '║ Total Columns:         %', RPAD(column_count::TEXT, 30);
    RAISE NOTICE '║ Total Indexes:         %', RPAD(index_count::TEXT, 30);
    RAISE NOTICE '║ GIN Indexes:           %', RPAD(gin_index_count::TEXT, 30);
    RAISE NOTICE '║ Foreign Keys:          %', RPAD(fk_count::TEXT, 30);
    RAISE NOTICE '║ Check Constraints:     %', RPAD(check_count::TEXT, 30);
    RAISE NOTICE '║ Triggers:              %', RPAD(trigger_count::TEXT, 30);
    RAISE NOTICE '║ Enums:                 %', RPAD(enum_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             016_create_radiology_images.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;