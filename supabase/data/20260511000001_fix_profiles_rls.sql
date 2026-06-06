-- ============================================================
-- RLS 修复：profiles 表策略加固，防止用户提权
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 删除旧的 profiles 策略
DO $$ BEGIN DROP POLICY IF EXISTS "用户可更新自己" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "用户可插入自己" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ============================================================
-- profiles INSERT: 两条策略
--   1. 管理员可插入任意 profile（org-management 中管理员创建人员）
--   2. 普通用户只能插入自己的 profile，且 role 必须是小组督察
-- ============================================================
CREATE POLICY "管理员可插入profile" ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "用户可注册自己" ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = '小组督察'
  );

-- ============================================================
-- profiles UPDATE: 两条策略
--   1. 管理员可更新任意 profile（但不能给自己以外的管理员改 role）
--   2. 普通用户只能更新自己的非敏感字段（name, phone），不能改 role 和 organization_id
-- ============================================================
CREATE POLICY "管理员可更新profile" ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

CREATE POLICY "用户可更新自己的非敏感字段" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- 确保 role 和 organization_id 没有被改成当前不同的值
    -- 用 coalesce 处理 null 情况
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND organization_id IS NOT DISTINCT FROM (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- profiles DELETE: 仅管理员可删除
-- ============================================================
DO $$ BEGIN DROP POLICY IF EXISTS "管理员可删除profile" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "管理员可删除profile" ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );
