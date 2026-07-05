-- Big-class secretariat administrators inherit write access across their
-- big class, classes, and groups without becoming platform administrators.

CREATE OR REPLACE FUNCTION app_private.has_secretariat_org_scope(
  target_semester_id BIGINT,
  target_org_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE target_chain AS (
    SELECT organization.id, organization.parent_id
    FROM public.organizations AS organization
    WHERE organization.id = target_org_id
      AND organization.semester_id = target_semester_id

    UNION ALL

    SELECT parent.id, parent.parent_id
    FROM public.organizations AS parent
    JOIN target_chain AS child ON child.parent_id = parent.id
    WHERE parent.semester_id = target_semester_id
  )
  SELECT app_private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.module_memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.semester_id = target_semester_id
        AND membership.module_key = 'secretariat'
        AND membership.enabled = TRUE
        AND (
          membership.org_id IN (SELECT id FROM target_chain)
          OR (
            membership.org_id IS NULL
            AND membership.role IN ('秘书处', '管理员', 'admin', 'manager')
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION app_private.has_secretariat_org_scope(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_secretariat_org_scope(BIGINT, BIGINT) TO authenticated;

-- Organization writes are limited to the caller's secretariat subtree.
DROP POLICY IF EXISTS "秘书处可管理组织" ON public.organizations;
DROP POLICY IF EXISTS "秘书处可新增权限范围内组织" ON public.organizations;
DROP POLICY IF EXISTS "秘书处可修改权限范围内组织" ON public.organizations;
DROP POLICY IF EXISTS "秘书处可删除权限范围内组织" ON public.organizations;

CREATE POLICY "秘书处可新增权限范围内组织"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (
  app_private.is_platform_admin()
  OR (
    level IN ('班级', '小组')
    AND parent_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, parent_id)
  )
);

CREATE POLICY "秘书处可修改权限范围内组织"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  app_private.has_secretariat_org_scope(semester_id, id)
)
WITH CHECK (
  app_private.has_secretariat_org_scope(semester_id, id)
  AND (
    parent_id IS NULL
    OR app_private.has_secretariat_org_scope(semester_id, parent_id)
  )
);

CREATE POLICY "秘书处可删除权限范围内组织"
ON public.organizations FOR DELETE
TO authenticated
USING (
  app_private.has_secretariat_org_scope(semester_id, id)
);

-- Organization assignments are writable only inside the same subtree.
DROP POLICY IF EXISTS "秘书处可管理 person_org_assignments" ON public.person_org_assignments;
DROP POLICY IF EXISTS "秘书处可新增权限范围内组织归属" ON public.person_org_assignments;
DROP POLICY IF EXISTS "秘书处可修改权限范围内组织归属" ON public.person_org_assignments;
DROP POLICY IF EXISTS "秘书处可删除权限范围内组织归属" ON public.person_org_assignments;

CREATE POLICY "秘书处可新增权限范围内组织归属"
ON public.person_org_assignments FOR INSERT
TO authenticated
WITH CHECK (
  app_private.has_secretariat_org_scope(semester_id, org_id)
);

CREATE POLICY "秘书处可修改权限范围内组织归属"
ON public.person_org_assignments FOR UPDATE
TO authenticated
USING (
  app_private.has_secretariat_org_scope(semester_id, org_id)
)
WITH CHECK (
  app_private.has_secretariat_org_scope(semester_id, org_id)
);

CREATE POLICY "秘书处可删除权限范围内组织归属"
ON public.person_org_assignments FOR DELETE
TO authenticated
USING (
  app_private.has_secretariat_org_scope(semester_id, org_id)
);

-- A person is created before their organization assignment in the existing UI,
-- so INSERT remains available to current secretariat managers. Updates and
-- deletes require a manageable assignment, except for genuinely unassigned
-- records that still need to be placed.
DROP POLICY IF EXISTS "秘书处可管理 people" ON public.people;
DROP POLICY IF EXISTS "秘书处可新增人员" ON public.people;
DROP POLICY IF EXISTS "秘书处可修改权限范围内人员" ON public.people;
DROP POLICY IF EXISTS "秘书处可删除权限范围内人员" ON public.people;

CREATE POLICY "秘书处可新增人员"
ON public.people FOR INSERT
TO authenticated
WITH CHECK (
  app_private.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.semesters AS semester
    WHERE semester.is_current = 1
      AND app_private.has_module_access(semester.id, 'secretariat', NULL)
  )
);

CREATE POLICY "秘书处可修改权限范围内人员"
ON public.people FOR UPDATE
TO authenticated
USING (
  app_private.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND app_private.has_secretariat_org_scope(assignment.semester_id, assignment.org_id)
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    JOIN public.semesters AS semester ON semester.id = assignment.semester_id
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND semester.is_current = 1
  )
)
WITH CHECK (
  app_private.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND app_private.has_secretariat_org_scope(assignment.semester_id, assignment.org_id)
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    JOIN public.semesters AS semester ON semester.id = assignment.semester_id
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND semester.is_current = 1
  )
);

CREATE POLICY "秘书处可删除权限范围内人员"
ON public.people FOR DELETE
TO authenticated
USING (
  app_private.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND app_private.has_secretariat_org_scope(assignment.semester_id, assignment.org_id)
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.person_org_assignments AS assignment
    JOIN public.semesters AS semester ON semester.id = assignment.semester_id
    WHERE assignment.person_id = people.id
      AND assignment.status = 'active'
      AND semester.is_current = 1
  )
);

-- Entry-form management follows its source organization. Legacy rows without
-- an organization remain visible to current secretariat managers for cleanup.
DROP POLICY IF EXISTS "秘书处可查看进班表单" ON public.entry_forms;
DROP POLICY IF EXISTS "秘书处可新增进班表单" ON public.entry_forms;
DROP POLICY IF EXISTS "秘书处可更新进班表单" ON public.entry_forms;
DROP POLICY IF EXISTS "秘书处可删除进班表单" ON public.entry_forms;

CREATE POLICY "秘书处可查看进班表单"
ON public.entry_forms FOR SELECT
TO authenticated
USING (
  app_private.is_platform_admin()
  OR (
    org_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, org_id)
  )
  OR (
    org_id IS NULL
    AND app_private.has_module_access(semester_id, 'secretariat', NULL)
  )
);

CREATE POLICY "秘书处可新增进班表单"
ON public.entry_forms FOR INSERT
TO authenticated
WITH CHECK (
  person_id IS NULL
  AND COALESCE(status, 'active') = 'active'
  AND (
    app_private.is_platform_admin()
    OR (
      org_id IS NOT NULL
      AND app_private.has_secretariat_org_scope(semester_id, org_id)
    )
    OR (
      org_id IS NULL
      AND app_private.has_module_access(semester_id, 'secretariat', NULL)
    )
  )
);

CREATE POLICY "秘书处可更新进班表单"
ON public.entry_forms FOR UPDATE
TO authenticated
USING (
  app_private.is_platform_admin()
  OR (
    org_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, org_id)
  )
  OR (
    org_id IS NULL
    AND app_private.has_module_access(semester_id, 'secretariat', NULL)
  )
)
WITH CHECK (
  app_private.is_platform_admin()
  OR (
    org_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, org_id)
  )
  OR (
    org_id IS NULL
    AND app_private.has_module_access(semester_id, 'secretariat', NULL)
  )
);

CREATE POLICY "秘书处可删除进班表单"
ON public.entry_forms FOR DELETE
TO authenticated
USING (
  app_private.is_platform_admin()
  OR (
    org_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, org_id)
  )
  OR (
    org_id IS NULL
    AND app_private.has_module_access(semester_id, 'secretariat', NULL)
  )
);

-- Secretariat managers can inspect permissions only in organizations they
-- manage. Users retain the separate policy that exposes their own rows.
DROP POLICY IF EXISTS "秘书处可查看当前学期模块身份" ON public.module_memberships;
CREATE POLICY "秘书处可查看权限范围内模块身份"
ON public.module_memberships FOR SELECT
TO authenticated
USING (
  app_private.is_platform_admin()
  OR (
    org_id IS NOT NULL
    AND app_private.has_secretariat_org_scope(semester_id, org_id)
  )
  OR (
    org_id IS NULL
    AND module_key = 'secretariat'
    AND user_id = (SELECT auth.uid())
  )
);
