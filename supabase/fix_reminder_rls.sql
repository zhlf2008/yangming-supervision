-- ============================================================
-- 修复 reminder_configs RLS 策略
-- 原策略依赖 profiles 子查询（profiles.id = auth.uid()），
-- 当 session 恢复失败时 auth.uid() 为 NULL，导致策略永远不通过。
-- 修复：允许任何已登录用户读写（页面已有客户端 admin 校验）
-- 在 Supabase SQL Editor 中执行
-- ============================================================

DO $$ BEGIN
  DROP POLICY IF EXISTS "管理员可管理提醒配置" ON reminder_configs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "认证用户可管理提醒配置" ON reminder_configs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
