-- Restrict secretariat position writes to the caller's organization level.
CREATE OR REPLACE FUNCTION app_private.can_manage_person_position_scope(
  target_semester_id BIGINT,
  target_org_id BIGINT,
  target_scope TEXT
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
      JOIN organizations manager_org ON manager_org.id = m.org_id
      JOIN organizations target_org ON target_org.id = target_org_id
      LEFT JOIN organizations target_parent ON target_parent.id = target_org.parent_id
      LEFT JOIN organizations target_grandparent ON target_grandparent.id = target_parent.parent_id
      WHERE m.user_id = auth.uid()
        AND m.semester_id = target_semester_id
        AND m.module_key = 'secretariat'
        AND m.enabled = TRUE
        AND manager_org.semester_id = target_semester_id
        AND target_org.semester_id = target_semester_id
        AND target_org.level = target_scope
        AND (
          (
            manager_org.level = '大班'
            AND (
              target_org.id = manager_org.id
              OR target_parent.id = manager_org.id
              OR target_grandparent.id = manager_org.id
            )
          )
          OR (
            manager_org.level = '班级'
            AND (
              target_org.id = manager_org.id
              OR target_parent.id = manager_org.id
            )
          )
          OR (
            manager_org.level = '小组'
            AND target_org.id = manager_org.id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION app_private.can_manage_person_position_scope(BIGINT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_manage_person_position_scope(BIGINT, BIGINT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "秘书处可管理 person_positions" ON person_positions;
DROP POLICY IF EXISTS "秘书处可新增权限范围内职务" ON person_positions;
DROP POLICY IF EXISTS "秘书处可修改权限范围内职务" ON person_positions;
DROP POLICY IF EXISTS "秘书处可删除权限范围内职务" ON person_positions;

CREATE POLICY "秘书处可新增权限范围内职务" ON person_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.can_manage_person_position_scope(semester_id, org_id, position_scope)
  );

CREATE POLICY "秘书处可修改权限范围内职务" ON person_positions
  FOR UPDATE TO authenticated
  USING (
    app_private.can_manage_person_position_scope(semester_id, org_id, position_scope)
  )
  WITH CHECK (
    app_private.can_manage_person_position_scope(semester_id, org_id, position_scope)
  );

CREATE POLICY "秘书处可删除权限范围内职务" ON person_positions
  FOR DELETE TO authenticated
  USING (
    app_private.can_manage_person_position_scope(semester_id, org_id, position_scope)
  );
