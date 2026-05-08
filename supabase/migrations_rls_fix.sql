-- ============================================================
-- RLS 修复：开启 organizations 和 profiles 表的 RLS 并创建 policy
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 启用 RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 先删除可能存在的旧 policy
-- ============================================================
DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "用户可更新自己" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "用户可插入自己" ON profiles; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看组织" ON organizations; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "管理员可管理组织" ON organizations; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ============================================================
-- profiles 的 RLS policy
-- ============================================================

-- 所有认证用户可查看 profiles（其他表 policy 的子查询依赖此表）
CREATE POLICY "认证用户可查看" ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 用户仅可更新自己的 profile
CREATE POLICY "用户可更新自己" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 允许插入自己的 profile（注册流程）
CREATE POLICY "用户可插入自己" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- organizations 的 RLS policy
-- ============================================================

-- 所有认证用户可查看组织
CREATE POLICY "认证用户可查看组织" ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 仅管理员可修改组织
CREATE POLICY "管理员可管理组织" ON organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );
