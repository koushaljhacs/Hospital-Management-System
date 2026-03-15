-- ============================================
-- FIXED OUTPUT VERIFICATION: 020_create_shifts.sql
-- ============================================

-- 1. Check table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'shifts';

-- 2. Count columns (should be 46)
SELECT COUNT(*) as total_columns 
FROM information_schema.columns 
WHERE table_name = 'shifts';

-- 3. Check generated columns
SELECT column_name, generation_expression 
FROM information_schema.columns 
WHERE table_name = 'shifts' AND is_generated = 'ALWAYS';

-- 4. Check enum (FIXED VERSION)
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'shift_type_enum'
GROUP BY t.typname;

-- 5. Quick summary
SELECT 
    'Shifts Table' as description,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'shifts') as columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'shifts' AND is_generated = 'ALWAYS') as generated,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'shifts') as indexes;