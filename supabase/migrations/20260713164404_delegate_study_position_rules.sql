-- 共读类型岗位按组织下放：大班提供默认模板，班级/小组可维护本级覆盖配置。

ALTER TABLE public.study_reading_type_positions
  ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.study_reading_type_positions position
SET org_id = reading_type.org_id
FROM public.study_reading_types reading_type
WHERE reading_type.id = position.reading_type_id
  AND position.org_id IS NULL;

ALTER TABLE public.study_reading_type_positions
  ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.study_reading_type_positions
  DROP CONSTRAINT IF EXISTS study_reading_type_positions_reading_type_id_role_name_key;

ALTER TABLE public.study_reading_type_positions
  DROP CONSTRAINT IF EXISTS study_reading_type_positions_type_org_role_key;

ALTER TABLE public.study_reading_type_positions
  ADD CONSTRAINT study_reading_type_positions_type_org_role_key
  UNIQUE (reading_type_id, org_id, role_name);

CREATE INDEX IF NOT EXISTS idx_study_reading_type_positions_org
ON public.study_reading_type_positions(org_id, reading_type_id, is_enabled, sort_order, id);

COMMENT ON COLUMN public.study_reading_type_positions.org_id IS
  '岗位配置归属组织；大班行为默认模板，班级/小组行覆盖对应层级模板。';

CREATE OR REPLACE FUNCTION app_private.can_manage_study_type_position(
  target_reading_type_id BIGINT,
  target_org_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_reading_types reading_type
    JOIN public.organizations target_org
      ON target_org.id = target_org_id
     AND target_org.semester_id = reading_type.semester_id
    LEFT JOIN public.organizations target_parent
      ON target_parent.id = target_org.parent_id
     AND target_parent.semester_id = reading_type.semester_id
    WHERE reading_type.id = target_reading_type_id
      AND (
        target_org.id = reading_type.org_id
        OR (
          reading_type.scope_level = '班级'
          AND target_org.level = '班级'
          AND target_org.parent_id = reading_type.org_id
        )
        OR (
          reading_type.scope_level = '小组'
          AND target_org.level = '小组'
          AND target_parent.level = '班级'
          AND target_parent.parent_id = reading_type.org_id
        )
      )
      AND app_private.has_module_org_scope(
        reading_type.semester_id,
        'study',
        target_org.id,
        ARRAY['学委', '副学委', '管理员', 'admin', 'manager']
      )
  );
$$;

REVOKE ALL ON FUNCTION app_private.can_manage_study_type_position(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_manage_study_type_position(BIGINT, BIGINT)
TO authenticated, service_role;

DROP POLICY IF EXISTS "大班学委可管理类型岗位" ON public.study_reading_type_positions;
DROP POLICY IF EXISTS "学委可管理本级类型岗位" ON public.study_reading_type_positions;

CREATE POLICY "学委可管理本级类型岗位"
ON public.study_reading_type_positions FOR ALL
TO authenticated
USING (
  app_private.can_manage_study_type_position(reading_type_id, org_id)
)
WITH CHECK (
  app_private.can_manage_study_type_position(reading_type_id, org_id)
);
