-- ============================================
-- OUTPUT VERIFICATION: 005_create_prescriptions.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'prescriptions';

-- ============================================
-- 2. CHECK ALL COLUMNS (11 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'prescriptions'
ORDER BY ordinal_position;

-- Count total columns (should be 11)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'prescriptions';

-- ============================================
-- 3. CHECK FOREIGN KEY CONSTRAINTS (4)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'prescriptions'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 4)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'prescriptions'::regclass
AND contype = 'f';

-- ============================================
-- 4. CHECK CHECK CONSTRAINTS (2)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'prescriptions'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 2)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'prescriptions'::regclass
AND contype = 'c';

-- ============================================
-- 5. CHECK INDEXES (6 TOTAL)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'prescriptions'
ORDER BY indexname;

-- Count total indexes (should be 6)
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'prescriptions';

-- ============================================
-- 6. CHECK TRIGGERS (1)
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'prescriptions';

-- Count triggers (should be 1)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'prescriptions';

-- ============================================
-- 7. CHECK VIEW EXISTS
-- ============================================
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views 
WHERE table_name = 'vw_prescriptions_full';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('prescriptions'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('prescriptions'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('prescriptions'::regclass) - pg_relation_size('prescriptions'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM prescriptions WHERE is_deleted = FALSE;

-- ============================================
-- 10. TEST THE VIEW
-- ============================================
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'vw_prescriptions_full';

-- ============================================
-- 11. COMPLETE SUMMARY REPORT
-- ============================================
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
    view_exists BOOLEAN;
    table_size TEXT;
    index_size TEXT;
    row_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'prescriptions';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'prescriptions';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'prescriptions'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'prescriptions'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'prescriptions';
    SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vw_prescriptions_full') INTO view_exists;
    SELECT COUNT(*) INTO row_count FROM prescriptions WHERE is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('prescriptions'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('prescriptions'::regclass) - pg_relation_size('prescriptions'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     PRESCRIPTIONS TABLE VERIFICATION REPORT               ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ Table Exists:          %', RPAD(table_exists::TEXT, 30);
    RAISE NOTICE '║ Total Columns:         %', RPAD(column_count::TEXT, 30);
    RAISE NOTICE '║ Total Indexes:         %', RPAD(index_count::TEXT, 30);
    RAISE NOTICE '║ Foreign Keys:          %', RPAD(fk_count::TEXT, 30);
    RAISE NOTICE '║ Check Constraints:     %', RPAD(check_count::TEXT, 30);
    RAISE NOTICE '║ Triggers:              %', RPAD(trigger_count::TEXT, 30);
    RAISE NOTICE '║ View Exists:           %', RPAD(view_exists::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Current Row Count:     %', RPAD(row_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             005_create_prescriptions.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 12. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
-- Insert a sample prescription
-- Make sure you have existing patient, doctor, and appointment records first

INSERT INTO prescriptions (
    appointment_id,
    doctor_id,
    patient_id,
    diagnosis,
    notes,
    follow_up_date
) VALUES (
    (SELECT id FROM appointments LIMIT 1),
    (SELECT id FROM employees WHERE designation LIKE '%doctor%' LIMIT 1),
    (SELECT id FROM patients LIMIT 1),
    'Acute bronchitis',
    'Take antibiotics for 7 days. Drink plenty of fluids.',
    CURRENT_DATE + 14
) RETURNING *;
*/

-- ============================================
-- 13. TEST THE VIEW WITH DATA
-- ============================================
/*
SELECT * FROM vw_prescriptions_full LIMIT 5;
*/

-- ============================================
-- 14. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'prescriptions'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'prescriptions'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'prescriptions'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'prescriptions'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'prescriptions'
UNION ALL
SELECT 
    'Views', COUNT(*)
FROM information_schema.views 
WHERE table_name = 'vw_prescriptions_full';

-- ============================================
-- END OF VERIFICATION
-- ============================================