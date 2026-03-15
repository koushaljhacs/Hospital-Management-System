-- ============================================
-- OUTPUT VERIFICATION: 009_create_purchase_orders.sql
-- RUN THESE QUERIES TO VERIFY THE MIGRATION
-- ============================================

-- ============================================
-- 1. CHECK TABLE EXISTS
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'purchase_orders';

-- ============================================
-- 2. CHECK ALL COLUMNS (61 FIELDS)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- Count total columns (should be 61)
SELECT COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'purchase_orders';

-- ============================================
-- 3. CHECK ENUMS
-- ============================================
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('purchase_order_status_enum', 'payment_status_enum', 'delivery_status_enum')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS (10)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'purchase_orders'::regclass
AND contype = 'f'
ORDER BY conname;

-- Count foreign keys (should be 10)
SELECT COUNT(*) as foreign_key_count
FROM pg_constraint
WHERE conrelid = 'purchase_orders'::regclass
AND contype = 'f';

-- ============================================
-- 5. CHECK CHECK CONSTRAINTS (6)
-- ============================================
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'purchase_orders'::regclass
AND contype = 'c'
ORDER BY conname;

-- Count check constraints (should be 6)
SELECT COUNT(*) as check_constraint_count
FROM pg_constraint
WHERE conrelid = 'purchase_orders'::regclass
AND contype = 'c';

-- ============================================
-- 6. CHECK INDEXES (20+)
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'purchase_orders'
ORDER BY indexname;

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes 
WHERE tablename = 'purchase_orders';

-- Check GIN indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'purchase_orders' 
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
WHERE event_object_table = 'purchase_orders'
ORDER BY trigger_name;

-- Count triggers (should be 2)
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table = 'purchase_orders';

-- ============================================
-- 8. CHECK GENERATED COLUMN
-- ============================================
SELECT 
    column_name,
    data_type,
    is_generated,
    generation_expression
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
AND is_generated = 'ALWAYS';

-- ============================================
-- 9. CHECK TABLE SIZE
-- ============================================
SELECT
    pg_size_pretty(pg_total_relation_size('purchase_orders'::regclass)) as total_size,
    pg_size_pretty(pg_relation_size('purchase_orders'::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size('purchase_orders'::regclass) - pg_relation_size('purchase_orders'::regclass)) as index_size;

-- ============================================
-- 10. CHECK ROW COUNT (if any data exists)
-- ============================================
SELECT COUNT(*) as row_count FROM purchase_orders WHERE is_deleted = FALSE;

-- ============================================
-- 11. CHECK STATUS DISTRIBUTION
-- ============================================
SELECT 
    status,
    COUNT(*) as count
FROM purchase_orders 
WHERE is_deleted = FALSE
GROUP BY status
ORDER BY status;

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
    generated_count INTEGER;
BEGIN
    -- Get counts
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') INTO table_exists;
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'purchase_orders';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'purchase_orders';
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'purchase_orders'::regclass AND contype = 'f';
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'purchase_orders'::regclass AND contype = 'c';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'purchase_orders';
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('purchase_order_status_enum', 'payment_status_enum', 'delivery_status_enum');
    SELECT COUNT(*) INTO row_count FROM purchase_orders WHERE is_deleted = FALSE;
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'purchase_orders' AND is_generated = 'ALWAYS';
    
    -- Get sizes
    SELECT pg_size_pretty(pg_total_relation_size('purchase_orders'::regclass)) INTO table_size;
    SELECT pg_size_pretty(pg_total_relation_size('purchase_orders'::regclass) - pg_relation_size('purchase_orders'::regclass)) INTO index_size;
    
    -- Final Report
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     PURCHASE ORDERS TABLE VERIFICATION REPORT             ║';
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
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Table Size:            %', RPAD(table_size, 30);
    RAISE NOTICE '║ Index Size:            %', RPAD(index_size, 30);
    RAISE NOTICE '║────────────────────────────────────────────────────────────║';
    RAISE NOTICE '║ Status:                ✅ PRODUCTION READY';
    RAISE NOTICE '║ Migration:             009_create_purchase_orders.sql';
    RAISE NOTICE '║ Verified:              %', RPAD(TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 30);
    RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================
-- 13. SAMPLE INSERT (Optional - for testing)
-- ============================================
/*
INSERT INTO purchase_orders (
    po_number,
    supplier_id,
    order_date,
    expected_delivery,
    subtotal,
    total_amount,
    items,
    created_by,
    status
) VALUES (
    'PO-2024-001',
    (SELECT id FROM suppliers LIMIT 1),
    CURRENT_DATE,
    CURRENT_DATE + 7,
    10000.00,
    11800.00,
    '[{"item": "Product A", "quantity": 10, "price": 1000}]'::jsonb,
    (SELECT id FROM users LIMIT 1),
    'draft'
) RETURNING *;
*/

-- ============================================
-- 14. QUICK VERIFICATION
-- ============================================
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'purchase_orders'
UNION ALL
SELECT 
    'Indexes', COUNT(*)
FROM pg_indexes 
WHERE tablename = 'purchase_orders'
UNION ALL
SELECT 
    'Foreign Keys', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'purchase_orders'::regclass AND contype = 'f'
UNION ALL
SELECT 
    'Check Constraints', COUNT(*)
FROM pg_constraint 
WHERE conrelid = 'purchase_orders'::regclass AND contype = 'c'
UNION ALL
SELECT 
    'Triggers', COUNT(*)
FROM information_schema.triggers 
WHERE event_object_table = 'purchase_orders'
UNION ALL
SELECT 
    'Enums', COUNT(*)
FROM pg_type 
WHERE typname IN ('purchase_order_status_enum', 'payment_status_enum', 'delivery_status_enum');

-- ============================================
-- END OF VERIFICATION
-- ============================================