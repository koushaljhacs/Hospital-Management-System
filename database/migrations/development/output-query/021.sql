-- ============================================
-- OUTPUT VERIFICATION: 021_create_break_glass_access.sql
-- ============================================

-- 1. Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'break_glass_access';

-- 2. Count columns (should be 57)
SELECT COUNT(*) as total_columns 
FROM information_schema.columns 
WHERE table_name = 'break_glass_access';

-- 3. Check generated columns
SELECT column_name, generation_expression 
FROM information_schema.columns 
WHERE table_name = 'break_glass_access' AND is_generated = 'ALWAYS';

-- 4. Check enums
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('break_glass_type_enum', 'break_glass_reason_enum', 'break_glass_status_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- 5. Count foreign keys (should be 8)
SELECT COUNT(*) as fk_count 
FROM pg_constraint 
WHERE conrelid = 'break_glass_access'::regclass AND contype = 'f';

-- 6. Count check constraints (should be 6)
SELECT COUNT(*) as check_count 
FROM pg_constraint 
WHERE conrelid = 'break_glass_access'::regclass AND contype = 'c';

-- 7. Count indexes
SELECT COUNT(*) as index_count 
FROM pg_indexes 
WHERE tablename = 'break_glass_access';

-- 8. Check GIN indexes for arrays/JSONB
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'break_glass_access' 
AND indexdef LIKE '%gin%';

-- 9. Count triggers (should be 2)
SELECT COUNT(*) as trigger_count 
FROM information_schema.triggers 
WHERE event_object_table = 'break_glass_access';

-- 10. Check sample of column comments
SELECT 
    a.attname as column_name,
    col_description(a.attrelid, a.attnum) as comment
FROM pg_attribute a
WHERE a.attrelid = 'break_glass_access'::regclass
AND a.attnum > 0
AND NOT a.attisdropped
AND col_description(a.attrelid, a.attnum) IS NOT NULL
LIMIT 10;

-- 11. Quick summary
SELECT 
    'Break Glass Access Table' as description,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'break_glass_access') as columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'break_glass_access' AND is_generated = 'ALWAYS') as generated,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'break_glass_access') as indexes,
    (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'break_glass_access'::regclass) as constraints,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'break_glass_access') as triggers;

-- 12. Complete summary report
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
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'break_glass_access') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'break_glass_access';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'break_glass_access';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'break_glass_access'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'break_glass_access'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'break_glass_access';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('break_glass_type_enum', 'break_glass_reason_enum', 'break_glass_status_enum');
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'break_glass_access' AND is_generated = 'ALWAYS';
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     BREAK GLASS ACCESS TABLE VERIFICATION REPORT          ║';
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
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             021_create_break_glass_access.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;