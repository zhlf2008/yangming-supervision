-- ============================================================
-- 模块权限按学期隔离：module_memberships 加 semester_id
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 新增 semester_id 列（先可空，用于回填数据后加 NOT NULL）
ALTER TABLE module_memberships
ADD COLUMN semester_id BIGINT REFERENCES semesters(id) ON DELETE CASCADE;

-- 2. 回填：将现有模块身份关联到当前学期
--    如果系统当前有 is_current=1 的学期，就用它；
--    如果没有当前学期，跳过回填
DO $$
DECLARE
  current_sem_id BIGINT;
BEGIN
  SELECT id INTO current_sem_id FROM semesters WHERE is_current = 1 LIMIT 1;
  IF current_sem_id IS NOT NULL THEN
    UPDATE module_memberships
    SET semester_id = current_sem_id
    WHERE semester_id IS NULL;
  END IF;
END $$;

-- 3. 对已有记录强制 NOT NULL
--    注意：如果 semesters 表中没有任何学期数据，此步会失败
--    请确保至少有一个学期后再执行
ALTER TABLE module_memberships
ALTER COLUMN semester_id SET NOT NULL;

-- 4. 重建唯一索引，包含 semester_id
DROP INDEX IF EXISTS idx_module_memberships_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_memberships_unique
ON module_memberships(user_id, module_key, role, semester_id, COALESCE(org_id, 0));

-- 5. 补充 semester_id 索引（加速按学期查询）
CREATE INDEX IF NOT EXISTS idx_module_memberships_semester
ON module_memberships(semester_id, enabled);

-- 6. 更新 RLS 策略：管理员可管理（保持全局，管理员本就不绑定学期）
--    用户查看自己的模块身份时，仍然只看自己的 user_id
--    （前端自己做学期过滤，RLS 层保持简单兼容）
DROP POLICY IF EXISTS "管理员可管理模块身份" ON module_memberships;
CREATE POLICY "管理员可管理模块身份" ON module_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

DROP POLICY IF EXISTS "用户可查看自己的模块身份" ON module_memberships;
CREATE POLICY "用户可查看自己的模块身份" ON module_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 7. 更新 updated_at 触发器（通用）
CREATE OR REPLACE FUNCTION update_module_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_module_memberships_updated_at ON module_memberships;
CREATE TRIGGER trg_module_memberships_updated_at
  BEFORE UPDATE ON module_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_module_memberships_updated_at();
