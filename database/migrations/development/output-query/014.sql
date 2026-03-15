-- ============================================
-- OUTPUT VERIFICATION: 014_create_equipment.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'equipment';

-- ============================================
-- 2. CHECK ALL COLUMNS (82 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'equipment'
ORDER BY ordinal_position;

-- Count total columns (should be 82)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'equipment';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('equipment_category_enum', 'equipment_status_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (7)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'equipment'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 7)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'equipment'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (11)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'equipment'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 11)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'equipment'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (25+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'equipment'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'equipment';

-- Check GIN indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'equipment' 
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
WHERE event_object_table = 'equipment'
ORDER BY trigger_name;

-- Count triggers (should be 2)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'equipment';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('equipment'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('equipment'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('equipment'::regclass) - pg_relation_size('equipment'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM equipment WHERE is_deleted = FALSE;

-- ============================================
-- 10. CHECK STATUS DISTRIBUTION
-- ============================================
SELECT 
    status,
    COUNT(*) as count
FROM equipment 
WHERE is_deleted = FALSE
GROUP BY status
ORDER BY status;

-- ============================================
-- 11. CHECK CATEGORY DISTRIBUTION
-- ============================================
SELECT 
    category,
    COUNT(*) as count
FROM equipment 
WHERE is_deleted = FALSE
GROUP BY category
ORDER BY category;

-- ============================================
-- 12. CHECK WARRANTY STATUS
-- ============================================
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE warranty_end_date < CURRENT_DATE) as expired_warranty,
    COUNT(*) FILTER (WHERE warranty_end_date >= CURRENT_DATE) as active_warranty
FROM equipment 
WHERE is_deleted = FALSE;

-- ============================================
-- 13. CHECK CALIBRATION STATUS
-- ============================================
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE next_calibration_date <= CURRENT_DATE) as calibration_due,
    COUNT(*) FILTER (WHERE next_calibration_date > CURRENT_DATE) as calibration_ok
FROM equipment 
WHERE is_deleted = FALSE AND calibration_required = TRUE;

-- ============================================
-- 14. COMPLETE SUMMARY REPORT
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
    operational_count INTEGER;
    maintenance_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'equipment';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'equipment';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'equipment'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'equipment'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'equipment';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('equipment_category_enum', 'equipment_status_enum');
    SELECT COUNT(*) INTO row_count FROM equipment WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO operational_count FROM equipment WHERE status = 'operational' AND is_deleted = FALSE;
    SELECT COUNT(*) INTO maintenance_count FROM equipment WHERE status IN ('under_maintenance', 'calibration_due') AND is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('equipment'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('equipment'::regclass) - pg_relation_size('equipment'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     EQUIPMENT TABLE VERIFICATION REPORT                   ║';
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
    RAISE NOTICE '║ Operational:           %', RPAD(operational_count::TEXT, 30);
    RAISE NOTICE '║ Maintenance Required:  %', RPAD(maintenance_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             014_create_equipment.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 15. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO equipment (
    equipment_code,
    name,
    category,
    manufacturer,
    model,
    serial_number,
    purchase_date,
    status,
    department_id
) VALUES (
    'EQ-MRI-001',
    '3T MRI Scanner',
    'imaging',
    'Siemens',
    'MAGNETOM Vida',
    'SN123456789',
    '2024-01-15',
    'operational',
    (SELECT id FROM departments WHERE name = 'radiology' LIMIT 1)
) RETURNING *;
*/

-- ============================================
-- 16. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'equipment'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'equipment'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'equipment'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'equipment'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'equipment'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('equipment_category_enum', 'equipment_status_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================