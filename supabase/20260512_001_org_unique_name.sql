-- ============================================================
-- 防止同一学期、同一父级下出现同名组织（大班/班级/小组）
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 先检查是否有已存在的重复数据（同名同父级）
SELECT semester_id, parent_id, level, name, COUNT(*) as cnt
FROM organizations
GROUP BY semester_id, parent_id, level, name
HAVING COUNT(*) > 1;

-- 如果有输出，说明存在重复，需要先在前端合并后再创建约束
-- 创建唯一索引（NULLS NOT DISTINCT 确保 NULL parent_id 的大班也能正确去重）
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_unique_name
ON organizations (semester_id, parent_id, level, name)
NULLS NOT DISTINCT;
