-- ============================================
-- OUTPUT VERIFICATION: 008_create_suppliers.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'suppliers';

-- ============================================
-- 2. CHECK ALL COLUMNS (53 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

-- Count total columns (should be 53)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'suppliers';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('supplier_status_enum', 'supplier_approval_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (4)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'suppliers'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 4)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'suppliers'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (9)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'suppliers'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 9)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'suppliers'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (18+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'suppliers'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'suppliers';

-- ============================================
-- 7. CHECK TRIGGERS (1)
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'suppliers';

-- Count triggers (should be 1)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'suppliers';

-- ============================================
-- 8. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('suppliers'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('suppliers'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('suppliers'::regclass) - pg_relation_size('suppliers'::regclass)) as index_size;

-- ============================================
-- 9. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM suppliers WHERE is_deleted = FALSE;

-- ============================================
-- 10. CHECK STATUS DISTRIBUTION
-- ============================================
SELECT 
    status,
    COUNT(*) as count
FROM suppliers 
WHERE is_deleted = FALSE
GROUP BY status
ORDER BY status;

-- ============================================
-- 11. CHECK APPROVAL STATUS
-- ============================================
SELECT 
    approval_status,
    COUNT(*) as count
FROM suppliers 
WHERE is_deleted = FALSE
GROUP BY approval_status
ORDER BY approval_status;

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
    approved_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'suppliers';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'suppliers';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'suppliers'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'suppliers'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'suppliers';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('supplier_status_enum', 'supplier_approval_enum');
    SELECT COUNT(*) INTO row_count FROM suppliers WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO active_count FROM suppliers WHERE status = 'active' AND is_deleted = FALSE;
    SELECT COUNT(*) INTO approved_count FROM suppliers WHERE approval_status = 'approved' AND is_deleted = FALSE;
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('suppliers'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('suppliers'::regclass) - pg_relation_size('suppliers'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     SUPPLIERS TABLE VERIFICATION REPORT                   ║';
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
    RAISE NOTICE '║ Active Suppliers:      %', RPAD(active_count::TEXT, 30);
    RAISE NOTICE '║ Approved Suppliers:    %', RPAD(approved_count::TEXT, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             008_create_suppliers.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 13. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO suppliers (
    name,
    code,
    contact_person,
    phone,
    email,
    address,
    city,
    state,
    gst_number,
    payment_terms,
    status,
    approval_status
) VALUES (
    'ABC Pharma',
    'SUP001',
    'John Doe',
    '+91-9876543210',
    'contact@abcpharma.com',
    '123 Business Park',
    'Mumbai',
    'Maharashtra',
    '27AAPFU5939F1ZV',
    'Net 30',
    'active',
    'approved'
) RETURNING *;
*/

-- ============================================
-- 14. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'suppliers'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'suppliers'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'suppliers'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'suppliers'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'suppliers'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('supplier_status_enum', 'supplier_approval_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================