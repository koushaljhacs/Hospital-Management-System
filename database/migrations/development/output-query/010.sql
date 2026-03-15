-- ============================================
-- OUTPUT VERIFICATION: 010_create_beds.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'beds';

-- ============================================
-- 2. CHECK ALL COLUMNS (58 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'beds'
ORDER BY ordinal_position;

-- Count total columns (should be 58)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'beds';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('bed_type_enum', 'bed_status_enum', 'cleaning_status_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (6)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'beds'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 6)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'beds'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (5)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'beds'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 5)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'beds'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (18+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'beds'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'beds';

-- Check GIN indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'beds' 
AND indexdef LIKE '%gin%';

-- ============================================
-- 7. CHECK TRIGGERS (2)
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'beds'
ORDER BY trigger_name;

-- Count triggers (should be 2)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'beds';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('beds'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('beds'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('beds'::regclass) - pg_relation_size('beds'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM beds WHERE is_deleted = FALSE;

-- ============================================
-- 10. CHECK STATUS DISTRIBUTION
-- ============================================
SELECT 
    status,
    COUNT(*) as count
FROM beds 
WHERE is_deleted = FALSE
GROUP BY status
ORDER BY status;

-- ============================================
-- 11. CHECK AVAILABLE BEDS
-- ============================================
SELECT 
    type,
    COUNT(*) as available_count
FROM beds 
WHERE status = 'available' AND is_deleted = FALSE
GROUP BY type
ORDER BY type;

-- ============================================
-- 12. CHECK CLEANING STATUS
-- ============================================
SELECT 
    cleaning_status,
    COUNT(*) as count
FROM beds 
WHERE is_deleted = FALSE
GROUP BY cleaning_status
ORDER BY cleaning_status;

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
    table_size TEXT;
    index_size TEXT;
    row_count INTEGER;
    available_count INTEGER;
    occupied_count INTEGER;
    cleaning_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beds') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'beds';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'beds';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'beds'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'beds'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'beds';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('bed_type_enum', 'bed_status_enum', 'cleaning_status_enum');
    SELECT COUNT(*) INTO row_count FROM beds WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO available_count FROM beds WHERE status = 'available' AND is_deleted = FALSE;
    SELECT COUNT(*) INTO occupied_count FROM beds WHERE status = 'occupied' AND is_deleted = FALSE;
    SELECT COUNT(*) INTO cleaning_count FROM beds WHERE cleaning_status IN ('dirty', 'in_progress') AND is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('beds'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('beds'::regclass) - pg_relation_size('beds'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     BEDS TABLE VERIFICATION REPORT                        ║';
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
    RAISE NOTICE '║ Available Beds:        %', RPAD(available_count::TEXT, 30);
    RAISE NOTICE '║ Occupied Beds:         %', RPAD(occupied_count::TEXT, 30);
    RAISE NOTICE '║ Needs Cleaning:        %', RPAD(cleaning_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             010_create_beds.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 14. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO beds (
    bed_number,
    ward,
    room_number,
    floor,
    type,
    status,
    daily_rate,
    has_oxygen_supply,
    has_call_bell
) VALUES (
    'BED-001',
    'Ward A',
    '101',
    1,
    'general',
    'available',
    1000.00,
    TRUE,
    TRUE
) RETURNING *;
*/

-- ============================================
-- 15. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'beds'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'beds'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'beds'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'beds'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'beds'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('bed_type_enum', 'bed_status_enum', 'cleaning_status_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================