-- ============================================================
-- 修复 study_courses RLS：允许平台管理员管理课程合集
-- 原有策略仅检查 module_memberships.study.admin/manager，
-- 没有涵盖 profiles.role IN ('超级管理员', '管理员')
-- ============================================================

DROP POLICY IF EXISTS "管理员可管理学委课程合集" ON study_courses;
CREATE POLICY "管理员可管理学委课程合集" ON study_courses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('超级管理员', '管理员')
  )
  OR
  EXISTS (
    SELECT 1 FROM module_memberships m
    WHERE m.user_id = auth.uid() AND m.module_key = 'study' AND m.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('超级管理员', '管理员')
  )
  OR
  EXISTS (
    SELECT 1 FROM module_memberships m
    WHERE m.user_id = auth.uid() AND m.module_key = 'study' AND m.role IN ('admin', 'manager')
  )
);
