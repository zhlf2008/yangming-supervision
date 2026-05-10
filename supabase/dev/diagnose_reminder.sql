-- 诊断：reminder_configs 数据问题
-- 在 Supabase SQL Editor 中执行，逐条查看结果

-- 1. 表是否存在
SELECT '1. reminder_configs表存在' AS step, EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'reminder_configs'
) AS result;

-- 2. RLS 是否启用
SELECT '2. RLS已启用' AS step, rowsecurity AS result
FROM pg_tables WHERE tablename = 'reminder_configs';

-- 3. 表中实际有多少行数据（无视 RLS）
SELECT '3. 数据行数' AS step, count(*) AS result FROM reminder_configs;

-- 4. 查看所有数据
SELECT '4. 数据内容' AS step, * FROM reminder_configs;

-- 5. 当前 RLS policy 列表
SELECT '5. RLS policies' AS step, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'reminder_configs';
