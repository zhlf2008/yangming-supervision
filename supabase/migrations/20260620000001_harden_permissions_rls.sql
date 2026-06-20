-- ============================================================
-- Harden module permissions, RLS boundaries, and public function data paths
-- Execute after 20260619 migrations.
-- ============================================================

-- Private helpers used by RLS policies. Keep them outside exposed schemas.
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('超级管理员', '管理员')
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_module_access(
  target_semester_id BIGINT,
  target_module_key TEXT,
  allowed_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM module_memberships m
      WHERE m.user_id = auth.uid()
        AND m.semester_id = target_semester_id
        AND m.module_key = target_module_key
        AND m.enabled = TRUE
        AND (allowed_roles IS NULL OR m.role = ANY(allowed_roles))
    );
$$;

REVOKE ALL ON FUNCTION app_private.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.has_module_access(BIGINT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_module_access(BIGINT, TEXT, TEXT[]) TO authenticated;

-- ============================================================
-- reminder_configs: remove broad authenticated write policy.
-- ============================================================
DROP POLICY IF EXISTS "认证用户可管理提醒配置" ON reminder_configs;
DROP POLICY IF EXISTS "管理员可管理提醒配置" ON reminder_configs;
CREATE POLICY "管理员可管理提醒配置" ON reminder_configs
  FOR ALL
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

-- ============================================================
-- audit_logs: keep inserts for authenticated users, but viewing is admin-only.
-- ============================================================
DROP POLICY IF EXISTS "认证用户可查看日志" ON audit_logs;
DROP POLICY IF EXISTS "管理员查看日志" ON audit_logs;
DROP POLICY IF EXISTS "管理员可查看日志" ON audit_logs;
CREATE POLICY "管理员可查看日志" ON audit_logs FOR SELECT
  USING (app_private.is_platform_admin());

-- ============================================================
-- module_memberships: users see self; secretariat can inspect current semester.
-- Writes stay behind platform admin or the service-role Edge Function.
-- ============================================================
DROP POLICY IF EXISTS "用户可查看自己的模块身份" ON module_memberships;
DROP POLICY IF EXISTS "秘书处可查看当前学期模块身份" ON module_memberships;
CREATE POLICY "用户可查看自己的模块身份" ON module_memberships FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "秘书处可查看当前学期模块身份" ON module_memberships FOR SELECT
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL));

-- ============================================================
-- Secretariat data: allow current secretariat module members to manage people,
-- assignments, positions, and semester organizations they are assigned to.
-- ============================================================
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_org_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "秘书处可管理 people" ON people;
CREATE POLICY "秘书处可管理 people" ON people FOR ALL
  USING (
    app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'secretariat', NULL)
    )
  )
  WITH CHECK (
    app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'secretariat', NULL)
    )
  );

DROP POLICY IF EXISTS "秘书处可管理 person_org_assignments" ON person_org_assignments;
CREATE POLICY "秘书处可管理 person_org_assignments" ON person_org_assignments FOR ALL
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL))
  WITH CHECK (app_private.has_module_access(semester_id, 'secretariat', NULL));

DROP POLICY IF EXISTS "秘书处可管理 person_positions" ON person_positions;
CREATE POLICY "秘书处可管理 person_positions" ON person_positions FOR ALL
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL))
  WITH CHECK (app_private.has_module_access(semester_id, 'secretariat', NULL));

DROP POLICY IF EXISTS "秘书处可管理组织" ON organizations;
CREATE POLICY "秘书处可管理组织" ON organizations FOR ALL
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL))
  WITH CHECK (app_private.has_module_access(semester_id, 'secretariat', NULL));

-- ============================================================
-- entry_forms: public can submit only new active forms; viewing/managing is
-- limited to platform admins and secretariat members in the same semester.
-- ============================================================
ALTER TABLE entry_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "认证用户可查看进班表单" ON entry_forms;
DROP POLICY IF EXISTS "秘书处可管理进班表单" ON entry_forms;
DROP POLICY IF EXISTS "外部可提交进班表单" ON entry_forms;

CREATE POLICY "秘书处可查看进班表单" ON entry_forms FOR SELECT
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL));

CREATE POLICY "秘书处可更新进班表单" ON entry_forms FOR UPDATE
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL))
  WITH CHECK (app_private.has_module_access(semester_id, 'secretariat', NULL));

CREATE POLICY "秘书处可删除进班表单" ON entry_forms FOR DELETE
  USING (app_private.has_module_access(semester_id, 'secretariat', NULL));

CREATE POLICY "外部可提交进班表单" ON entry_forms FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    person_id IS NULL
    AND COALESCE(status, 'active') = 'active'
  );

-- ============================================================
-- attendance_records: update/insert follows current supervision memberships.
-- SELECT remains authenticated for existing summaries and leaderboards.
-- ============================================================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "认证用户可查看考勤记录" ON attendance_records;
DROP POLICY IF EXISTS "用户可插入本组考勤" ON attendance_records;
DROP POLICY IF EXISTS "用户可更新本组考勤" ON attendance_records;
DROP POLICY IF EXISTS "管理员可管理所有考勤" ON attendance_records;
DROP POLICY IF EXISTS "督察可插入授权范围考勤" ON attendance_records;
DROP POLICY IF EXISTS "督察可更新授权范围考勤" ON attendance_records;
DROP POLICY IF EXISTS "管理员可删除考勤记录" ON attendance_records;

CREATE POLICY "认证用户可查看考勤记录" ON attendance_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "督察可插入授权范围考勤" ON attendance_records FOR INSERT
  WITH CHECK (
    app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM module_memberships m
      LEFT JOIN organizations g ON g.id = attendance_records.organization_id
      LEFT JOIN organizations c ON c.id = g.parent_id
      WHERE m.user_id = auth.uid()
        AND m.semester_id = attendance_records.semester_id
        AND m.module_key = 'supervision'
        AND m.enabled = TRUE
        AND (
          m.role IN ('管理员')
          OR (m.role IN ('小组督察', '小组副督察') AND m.org_id = attendance_records.organization_id)
          OR (m.role IN ('班级总督察', '班级副总督察') AND m.org_id = g.parent_id)
          OR (m.role IN ('大班总督', '大班副督') AND m.org_id = c.parent_id)
        )
    )
  );

CREATE POLICY "督察可更新授权范围考勤" ON attendance_records FOR UPDATE
  USING (
    app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM module_memberships m
      LEFT JOIN organizations g ON g.id = attendance_records.organization_id
      LEFT JOIN organizations c ON c.id = g.parent_id
      WHERE m.user_id = auth.uid()
        AND m.semester_id = attendance_records.semester_id
        AND m.module_key = 'supervision'
        AND m.enabled = TRUE
        AND (
          m.role IN ('管理员')
          OR (m.role IN ('小组督察', '小组副督察') AND m.org_id = attendance_records.organization_id)
          OR (m.role IN ('班级总督察', '班级副总督察') AND m.org_id = g.parent_id)
          OR (m.role IN ('大班总督', '大班副督') AND m.org_id = c.parent_id)
        )
    )
  )
  WITH CHECK (
    app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM module_memberships m
      LEFT JOIN organizations g ON g.id = attendance_records.organization_id
      LEFT JOIN organizations c ON c.id = g.parent_id
      WHERE m.user_id = auth.uid()
        AND m.semester_id = attendance_records.semester_id
        AND m.module_key = 'supervision'
        AND m.enabled = TRUE
        AND (
          m.role IN ('管理员')
          OR (m.role IN ('小组督察', '小组副督察') AND m.org_id = attendance_records.organization_id)
          OR (m.role IN ('班级总督察', '班级副总督察') AND m.org_id = g.parent_id)
          OR (m.role IN ('大班总督', '大班副督') AND m.org_id = c.parent_id)
        )
    )
  );

CREATE POLICY "管理员可删除考勤记录" ON attendance_records FOR DELETE
  USING (app_private.is_platform_admin());

-- ============================================================
-- Study module: accept current Chinese module role names and platform admins.
-- ============================================================
ALTER TABLE study_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_course_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_schedule_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_assignment_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_assignment_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "管理员可管理学委课程合集" ON study_courses;
CREATE POLICY "学委可管理课程合集" ON study_courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

DROP POLICY IF EXISTS "管理员可管理学委课程库" ON study_course_library;
CREATE POLICY "学委可管理课程库" ON study_course_library FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

DROP POLICY IF EXISTS "管理员可管理学委日程规则" ON study_schedule_rules;
CREATE POLICY "学委可管理日程规则" ON study_schedule_rules FOR ALL
  USING (app_private.has_module_access(semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager']))
  WITH CHECK (app_private.has_module_access(semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager']));

DROP POLICY IF EXISTS "管理员可管理学委日程实例" ON study_schedule_instances;
CREATE POLICY "学委可管理日程实例" ON study_schedule_instances FOR ALL
  USING (app_private.has_module_access(semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager']))
  WITH CHECK (app_private.has_module_access(semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager']));

DROP POLICY IF EXISTS "管理员可管理学委摊派" ON study_assignment_demands;
CREATE POLICY "学委可管理摊派" ON study_assignment_demands FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM study_schedule_instances si
      WHERE si.id = study_assignment_demands.schedule_instance_id
        AND app_private.has_module_access(si.semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM study_schedule_instances si
      WHERE si.id = study_assignment_demands.schedule_instance_id
        AND app_private.has_module_access(si.semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

DROP POLICY IF EXISTS "管理员可管理学委落位" ON study_assignment_people;
CREATE POLICY "学委可管理落位" ON study_assignment_people FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM study_assignment_demands d
      JOIN study_schedule_instances si ON si.id = d.schedule_instance_id
      WHERE d.id = study_assignment_people.demand_id
        AND app_private.has_module_access(si.semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM study_assignment_demands d
      JOIN study_schedule_instances si ON si.id = d.schedule_instance_id
      WHERE d.id = study_assignment_people.demand_id
        AND app_private.has_module_access(si.semester_id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

DROP POLICY IF EXISTS "管理员可上传课程封面" ON storage.objects;
DROP POLICY IF EXISTS "管理员可更新课程封面" ON storage.objects;
DROP POLICY IF EXISTS "管理员可删除课程封面" ON storage.objects;
DROP POLICY IF EXISTS "学委可上传课程封面" ON storage.objects;
DROP POLICY IF EXISTS "学委可更新课程封面" ON storage.objects;
DROP POLICY IF EXISTS "学委可删除课程封面" ON storage.objects;

CREATE POLICY "学委可上传课程封面" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-covers'
    AND EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

CREATE POLICY "学委可更新课程封面" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'study-covers'
    AND EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    bucket_id = 'study-covers'
    AND EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );

CREATE POLICY "学委可删除课程封面" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-covers'
    AND EXISTS (
      SELECT 1 FROM semesters s
      WHERE s.is_current = 1
        AND app_private.has_module_access(s.id, 'study', ARRAY['学委', '副学委', '管理员', 'admin', 'manager'])
    )
  );
