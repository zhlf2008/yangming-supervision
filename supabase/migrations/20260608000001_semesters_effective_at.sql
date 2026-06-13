-- ============================================================
-- semesters 表加 effective_at：支持未来学期自动切换
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 新增 effective_at 列（可空，不强制）
ALTER TABLE semesters
ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ;

-- 2. 索引：加速查询待生效学期
CREATE INDEX IF NOT EXISTS idx_semesters_effective_at
ON semesters(effective_at) WHERE effective_at IS NOT NULL;

-- 3. 已有当前学期的 effective_at 默认为其 start_date（兼容旧数据）
UPDATE semesters
SET effective_at = start_date::TIMESTAMPTZ
WHERE is_current = 1 AND effective_at IS NULL;

-- 4. 已有非当前学期但 start_date > NOW() 的设为 effective_at
UPDATE semesters
SET effective_at = start_date::TIMESTAMPTZ
WHERE is_current != 1 AND start_date > CURRENT_DATE AND effective_at IS NULL;
