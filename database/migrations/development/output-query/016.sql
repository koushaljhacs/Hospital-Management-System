-- Quick verification for 016
SELECT 
    'Columns' as object_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'test_orders'
UNION ALL
SELECT 
    'Generated Columns', COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'test_orders' AND is_generated = 'ALWAYS';