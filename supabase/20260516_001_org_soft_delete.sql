-- ============================================================
-- 组织架构软归档：添加 is_active 字段，避免硬删除导致历史数据断裂
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 1. 添加 is_active 列（默认 true，即活跃）
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. 回填已有数据为活跃
UPDATE organizations SET is_active = TRUE WHERE is_active IS NULL;

-- 3. 创建索引加速过滤查询
CREATE INDEX IF NOT EXISTS idx_orgs_active ON organizations (semester_id, is_active);

-- 4. 降级 reminder_configs 的 ON DELETE CASCADE（因为改用软删除）
--    注意：由于无法直接修改外键的 ON DELETE 行为，
--    这里删除旧的约束并重建为 ON DELETE SET NULL（软删场景下不删 org，仅作防护）
--    如果原约束不存在则跳过
DO $$
BEGIN
  ALTER TABLE reminder_configs DROP CONSTRAINT IF EXISTS reminder_configs_org_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE reminder_configs
    ADD CONSTRAINT reminder_configs_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
