-- ============================================================
-- 业务表 RLS 补全：semesters / assessment_types / schedules / attendance_records / feedback
-- 在 Supabase SQL Editor 中按顺序执行
-- ============================================================

-- ============================================================
-- 1. semesters — 所有认证用户可读，仅管理员可写
-- ============================================================
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看学期" ON semesters; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "认证用户可查看学期" ON semesters FOR SELECT
  USING (auth.uid() IS NOT NULL);

DO $$ BEGIN DROP POLICY IF EXISTS "管理员可管理学期" ON semesters; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "管理员可管理学期" ON semesters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

-- ============================================================
-- 2. assessment_types — 认证用户可读，管理员可写
-- ============================================================
ALTER TABLE assessment_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看考核项目" ON assessment_types; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "认证用户可查看考核项目" ON assessment_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

DO $$ BEGIN DROP POLICY IF EXISTS "管理员可管理考核项目" ON assessment_types; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "管理员可管理考核项目" ON assessment_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

-- ============================================================
-- 3. schedules — 认证用户可读，管理员和大班总督可写自己的大班
-- ============================================================
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看日程" ON schedules; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "认证用户可查看日程" ON schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

DO $$ BEGIN DROP POLICY IF EXISTS "管理员可管理日程" ON schedules; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "管理员可管理日程" ON schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

DO $$ BEGIN DROP POLICY IF EXISTS "大班总督可管理本大班日程" ON schedules; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "大班总督可管理本大班日程" ON schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('大班总督', '大班副督')
      AND profiles.organization_id = schedules.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('大班总督', '大班副督')
      AND profiles.organization_id = schedules.org_id
    )
  );

-- ============================================================
-- 4. attendance_records — 认证用户可查看，用户只能新增/修改自己小组的记录
--   组织层级: 小组.parent_id = 班级, 班级.parent_id = 大班
-- ============================================================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看考勤记录" ON attendance_records; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "认证用户可查看考勤记录" ON attendance_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 用户可插入自己小组的考勤记录
DO $$ BEGIN DROP POLICY IF EXISTS "用户可插入本组考勤" ON attendance_records; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "用户可插入本组考勤" ON attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = attendance_records.organization_id
    )
  );

-- 用户可更新自己小组的考勤记录
DO $$ BEGIN DROP POLICY IF EXISTS "用户可更新本组考勤" ON attendance_records; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "用户可更新本组考勤" ON attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = attendance_records.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = attendance_records.organization_id
    )
  );

-- 管理员可管理所有考勤记录
DO $$ BEGIN DROP POLICY IF EXISTS "管理员可管理所有考勤" ON attendance_records; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "管理员可管理所有考勤" ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );

-- ============================================================
-- 5. feedback — 认证用户可查看，用户可插入自己的反馈，管理员可回复
-- ============================================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "认证用户可查看反馈" ON feedback; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "认证用户可查看反馈" ON feedback FOR SELECT
  USING (auth.uid() IS NOT NULL);

DO $$ BEGIN DROP POLICY IF EXISTS "用户可提交反馈" ON feedback; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "用户可提交反馈" ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN DROP POLICY IF EXISTS "管理员可回复反馈" ON feedback; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "管理员可回复反馈" ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('超级管理员', '管理员')
    )
  );
