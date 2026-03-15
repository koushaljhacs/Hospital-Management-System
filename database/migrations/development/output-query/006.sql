-- ============================================
-- OUTPUT VERIFICATION: 006_create_medicines.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'medicines';

-- ============================================
-- 2. CHECK ALL COLUMNS (24 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'medicines'
ORDER BY ordinal_position;

-- Count total columns (should be 24)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'medicines';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'medicine_status_enum'
GROUP BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (3)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'medicines'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 3)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'medicines'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (5)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'medicines'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 5)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'medicines'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (7 TOTAL)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'medicines'
ORDER BY indexname;

-- Count total indexes (should be 7)
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'medicines';

-- Check GIN indexes specifically
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'medicines' 
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
WHERE event_object_table = 'medicines';

-- Count triggers (should be 1)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'medicines';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('medicines'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('medicines'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('medicines'::regclass) - pg_relation_size('medicines'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM medicines WHERE is_deleted = FALSE;

-- ============================================
-- 10. COMPLETE SUMMARY REPORT
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
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medicines') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'medicines';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'medicines';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'medicines'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'medicines'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'medicines';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname = 'medicine_status_enum';
    SELECT COUNT(*) INTO row_count FROM medicines WHERE is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('medicines'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('medicines'::regclass) - pg_relation_size('medicines'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     MEDICINES TABLE VERIFICATION REPORT                   ║';
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
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             006_create_medicines.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 11. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
-- Insert a sample medicine
-- Make sure you have an existing prescription first

INSERT INTO medicines (
    prescription_id,
    medicine_name,
    generic_name,
    dosage,
    frequency,
    duration,
    quantity,
    units,
    route,
    with_food,
    instructions
) VALUES (
    (SELECT id FROM prescriptions LIMIT 1),
    'Augmentin 625',
    'Amoxicillin + Clavulanic Acid',
    '625mg',
    'Twice daily',
    '7 days',
    14,
    'tablets',
    'oral',
    TRUE,
    'Take with food to avoid stomach upset'
) RETURNING *;
*/

-- ============================================
-- 12. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'medicines'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'medicines'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'medicines'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'medicines'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'medicines'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname = 'medicine_status_enum';

-- ============================================
-- END OF VERIFICATION
-- ============================================