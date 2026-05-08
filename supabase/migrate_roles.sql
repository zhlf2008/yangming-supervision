-- ============================================================
-- 角色重命名迁移：管理员→超级管理员，地区督委→管理员
-- 系统级角色清除组织归属
-- ============================================================

-- 1. 更新现有用户角色名称
UPDATE profiles SET role = '超级管理员' WHERE role = '管理员';
UPDATE profiles SET role = '管理员' WHERE role = '地区督委';

-- 2. 系统级角色清除组织归属
UPDATE profiles SET organization_id = NULL WHERE role IN ('超级管理员', '管理员');

-- 3. 更新 audit_logs 表的 RLS 策略（超级管理员和管理员可查看日志）
DROP POLICY IF EXISTS "管理员可查看日志" ON audit_logs;
CREATE POLICY "超级管理员可查看日志" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

-- 4. 更新 reminder_configs 表的 RLS 策略（超级管理员和管理员可管理提醒配置）
DROP POLICY IF EXISTS "管理员可管理提醒配置" ON reminder_configs;
CREATE POLICY "超级管理员可管理提醒配置" ON reminder_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "超级管理员可修改提醒配置" ON reminder_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "超级管理员可更新提醒配置" ON reminder_configs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "超级管理员可删除提醒配置" ON reminder_configs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

-- 5. 更新 organizations 表的 RLS 策略（超级管理员和管理员可管理组织）
DROP POLICY IF EXISTS "管理员可管理组织" ON organizations;
CREATE POLICY "超级管理员可管理组织" ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "超级管理员可更新组织" ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "超级管理员可删除组织" ON organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );
