-- ============================================
-- FIXED OUTPUT VERIFICATION: 019_create_tasks.sql
-- ============================================

-- 1. Check table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'tasks';

-- 2. Count columns (should be 59)
SELECT COUNT(*) as total_columns 
FROM information_schema.columns 
WHERE table_name = 'tasks';

-- 3. Check enums (FIXED VERSION)
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('task_type_enum', 'task_priority_enum', 'task_status_enum')
GROUP BY t.typname;

-- 4. Count foreign keys (should be 17)
SELECT COUNT(*) as fk_count 
FROM pg_constraint 
WHERE conrelid = 'tasks'::regclass AND contype = 'f';

-- 5. Quick summary
SELECT 
    'Tasks Table' as description,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tasks') as columns,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'tasks') as indexes,
    (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'tasks'::regclass) as constraints;