-- ============================================================
-- audit_logs 加 module_key 和 semester_id：支持平台化审计
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 新增 module_key（区分日志来自哪个模块）
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS module_key TEXT;

-- 2. 新增 semester_id（区分日志属于哪个学期）
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS semester_id BIGINT REFERENCES semesters(id) ON DELETE SET NULL;

-- 3. 索引：加速按模块+学期查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_module
ON audit_logs(module_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_semester
ON audit_logs(semester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action, created_at DESC);
