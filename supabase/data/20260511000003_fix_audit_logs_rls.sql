-- 修复 audit_logs RLS：当前策略只允许管理员查看，但不允许普通用户 INSERT
-- 问题：logAction() 前端调用 insert 时被 RLS 静默拒绝（使用 anon key 无 service_role 权限）
-- 修复：所有认证用户可插入操作日志

DROP POLICY IF EXISTS "管理员查看日志" ON audit_logs;
DROP POLICY IF EXISTS "认证用户可插入日志" ON audit_logs;
DROP POLICY IF EXISTS "认证用户可查看日志" ON audit_logs;

-- 所有认证用户可插入日志（操作记录不能丢失）
CREATE POLICY "认证用户可插入日志" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 所有认证用户可查看日志
CREATE POLICY "认证用户可查看日志" ON audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 管理员可删除日志
CREATE POLICY "管理员可删除日志" ON audit_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = '超级管理员' OR profiles.role = '管理员')
    )
  );
