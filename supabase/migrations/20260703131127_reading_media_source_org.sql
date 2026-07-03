-- ============================================================
-- 共读影像来源组织：班级/大班日程下按小组归集上传与宣发设置
-- ============================================================

ALTER TABLE study_reading_media_assets
  ADD COLUMN IF NOT EXISTS source_org_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE study_reading_media_assets asset
SET source_org_id = person.org_id
FROM study_assignment_people person
WHERE person.id = asset.assignment_person_id
  AND person.org_id IS NOT NULL
  AND asset.source_org_id IS NULL;

UPDATE study_reading_media_assets
SET source_org_id = org_id
WHERE source_org_id IS NULL;

ALTER TABLE study_reading_media_assets
  ALTER COLUMN source_org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reading_media_assets_source_org
ON study_reading_media_assets(semester_id, source_org_id, schedule_instance_id, sort_order, id);

ALTER TABLE publicity_reading_posters
  ADD COLUMN IF NOT EXISTS source_org_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE publicity_reading_posters
SET source_org_id = org_id
WHERE source_org_id IS NULL;

ALTER TABLE publicity_reading_posters
  ALTER COLUMN source_org_id SET NOT NULL;

ALTER TABLE publicity_reading_posters
  DROP CONSTRAINT IF EXISTS publicity_reading_posters_schedule_instance_id_org_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_publicity_reading_posters_source_unique
ON publicity_reading_posters(schedule_instance_id, source_org_id);

CREATE INDEX IF NOT EXISTS idx_publicity_reading_posters_source_scope
ON publicity_reading_posters(semester_id, source_org_id, schedule_instance_id, status);

CREATE OR REPLACE FUNCTION app_private.has_module_related_org_scope(
  target_semester_id BIGINT,
  target_module_key TEXT,
  target_org_id BIGINT,
  allowed_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE membership_chain AS (
    SELECT
      membership.id AS membership_id,
      membership.org_id AS id,
      organization.parent_id
    FROM module_memberships membership
    JOIN organizations organization ON organization.id = membership.org_id
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.semester_id = target_semester_id
      AND membership.module_key = target_module_key
      AND membership.enabled = TRUE
      AND (allowed_roles IS NULL OR membership.role = ANY(allowed_roles))

    UNION ALL

    SELECT
      child.membership_id,
      parent.id,
      parent.parent_id
    FROM organizations parent
    JOIN membership_chain child ON child.parent_id = parent.id
    WHERE parent.semester_id = target_semester_id
  )
  SELECT app_private.is_platform_admin()
    OR app_private.has_module_org_scope(
      target_semester_id, target_module_key, target_org_id, allowed_roles
    )
    OR EXISTS (
      SELECT 1
      FROM membership_chain
      WHERE id = target_org_id
    )
    OR EXISTS (
      SELECT 1
      FROM module_memberships membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.semester_id = target_semester_id
        AND membership.module_key = target_module_key
        AND membership.enabled = TRUE
        AND membership.org_id IS NULL
        AND membership.role IN ('管理员', 'admin', 'manager')
        AND (allowed_roles IS NULL OR membership.role = ANY(allowed_roles))
    );
$$;

REVOKE ALL ON FUNCTION app_private.has_module_related_org_scope(BIGINT, TEXT, BIGINT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_module_related_org_scope(BIGINT, TEXT, BIGINT, TEXT[])
TO authenticated;

CREATE OR REPLACE FUNCTION app_private.validate_reading_media_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  schedule_row study_schedule_instances%ROWTYPE;
  assigned_name TEXT;
  assigned_role TEXT;
  assigned_org_id BIGINT;
  source_is_descendant BOOLEAN;
BEGIN
  SELECT *
  INTO schedule_row
  FROM study_schedule_instances
  WHERE id = NEW.schedule_instance_id;

  IF NOT FOUND
     OR schedule_row.semester_id IS DISTINCT FROM NEW.semester_id
     OR schedule_row.org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION '共读影像必须关联同一学期和组织的日程';
  END IF;

  IF NEW.assignment_person_id IS NOT NULL THEN
    SELECT
      person.person_name_snapshot,
      demand.role_name,
      person.org_id
    INTO assigned_name, assigned_role, assigned_org_id
    FROM study_assignment_people person
    JOIN study_assignment_demands demand ON demand.id = person.demand_id
    WHERE person.id = NEW.assignment_person_id
      AND demand.schedule_instance_id = NEW.schedule_instance_id;

    IF assigned_name IS NULL THEN
      RAISE EXCEPTION '所选岗位人员不属于当前共读日程';
    END IF;

    NEW.demand_id = (
      SELECT demand_id
      FROM study_assignment_people
      WHERE id = NEW.assignment_person_id
    );
    NEW.source_org_id = COALESCE(assigned_org_id, NEW.source_org_id, NEW.org_id);
    NEW.person_name_snapshot = assigned_name;
    NEW.role_name_snapshot = COALESCE(assigned_role, '');
    NEW.asset_kind = 'role';
  ELSIF NEW.demand_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM study_assignment_demands demand
    WHERE demand.id = NEW.demand_id
      AND demand.schedule_instance_id = NEW.schedule_instance_id
  ) THEN
    RAISE EXCEPTION '所选岗位不属于当前共读日程';
  END IF;

  NEW.source_org_id = COALESCE(NEW.source_org_id, NEW.org_id);

  WITH RECURSIVE source_chain AS (
    SELECT organization.id, organization.parent_id, organization.semester_id
    FROM organizations organization
    WHERE organization.id = NEW.source_org_id

    UNION ALL

    SELECT parent.id, parent.parent_id, parent.semester_id
    FROM organizations parent
    JOIN source_chain child ON child.parent_id = parent.id
  )
  SELECT EXISTS (
    SELECT 1
    FROM source_chain
    WHERE id = NEW.org_id
      AND semester_id = NEW.semester_id
  )
  INTO source_is_descendant;

  IF NOT source_is_descendant THEN
    RAISE EXCEPTION '照片来源组织不属于当前共读日程范围';
  END IF;

  NEW.caption = BTRIM(COALESCE(NEW.caption, ''));
  NEW.file_name = BTRIM(COALESCE(NEW.file_name, ''));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_publicity_reading_poster()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_is_descendant BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM study_schedule_instances schedule
    WHERE schedule.id = NEW.schedule_instance_id
      AND schedule.semester_id = NEW.semester_id
      AND schedule.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION '晨读长图必须关联同一学期和组织的日程';
  END IF;

  NEW.source_org_id = COALESCE(NEW.source_org_id, NEW.org_id);

  WITH RECURSIVE source_chain AS (
    SELECT organization.id, organization.parent_id, organization.semester_id
    FROM organizations organization
    WHERE organization.id = NEW.source_org_id

    UNION ALL

    SELECT parent.id, parent.parent_id, parent.semester_id
    FROM organizations parent
    JOIN source_chain child ON child.parent_id = parent.id
  )
  SELECT EXISTS (
    SELECT 1
    FROM source_chain
    WHERE id = NEW.org_id
      AND semester_id = NEW.semester_id
  )
  INTO source_is_descendant;

  IF NOT source_is_descendant THEN
    RAISE EXCEPTION '长图来源组织不属于当前共读日程范围';
  END IF;

  NEW.title = BTRIM(COALESCE(NEW.title, ''));
  NEW.subtitle = BTRIM(COALESCE(NEW.subtitle, ''));
  NEW.closing_text = BTRIM(COALESCE(NEW.closing_text, ''));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_publicity_reading_poster_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM publicity_reading_posters poster
    JOIN study_reading_media_assets asset
      ON asset.id = NEW.asset_id
     AND asset.schedule_instance_id = poster.schedule_instance_id
     AND asset.org_id = poster.org_id
     AND asset.source_org_id = poster.source_org_id
    WHERE poster.id = NEW.poster_id
  ) THEN
    RAISE EXCEPTION '所选照片不属于当前晨读长图';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "宣委可查看共读日程" ON study_schedule_instances;
CREATE POLICY "宣委可查看共读日程"
ON study_schedule_instances FOR SELECT
TO authenticated
USING (
  app_private.has_module_related_org_scope(semester_id, 'publicity', org_id, NULL)
);

DROP POLICY IF EXISTS "宣委可查看共读类型" ON study_reading_types;
CREATE POLICY "宣委可查看共读类型"
ON study_reading_types FOR SELECT
TO authenticated
USING (
  app_private.has_module_related_org_scope(semester_id, 'publicity', org_id, NULL)
);

DROP POLICY IF EXISTS "宣委可查看共读类型岗位" ON study_reading_type_positions;
CREATE POLICY "宣委可查看共读类型岗位"
ON study_reading_type_positions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM study_reading_types reading_type
    WHERE reading_type.id = study_reading_type_positions.reading_type_id
      AND app_private.has_module_related_org_scope(
        reading_type.semester_id, 'publicity', reading_type.org_id, NULL
      )
  )
);

DROP POLICY IF EXISTS "宣委可查看共读岗位安排" ON study_assignment_demands;
CREATE POLICY "宣委可查看共读岗位安排"
ON study_assignment_demands FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM study_schedule_instances schedule
    WHERE schedule.id = study_assignment_demands.schedule_instance_id
      AND app_private.has_module_related_org_scope(
        schedule.semester_id, 'publicity', schedule.org_id, NULL
      )
  )
);

DROP POLICY IF EXISTS "宣委可查看共读岗位人员" ON study_assignment_people;
CREATE POLICY "宣委可查看共读岗位人员"
ON study_assignment_people FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM study_assignment_demands demand
    JOIN study_schedule_instances schedule
      ON schedule.id = demand.schedule_instance_id
    WHERE demand.id = study_assignment_people.demand_id
      AND app_private.has_module_related_org_scope(
        schedule.semester_id, 'publicity', schedule.org_id, NULL
      )
  )
);

DROP POLICY IF EXISTS "宣委可查看共读内容" ON study_schedule_content;
CREATE POLICY "宣委可查看共读内容"
ON study_schedule_content FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM study_schedule_instances schedule
    WHERE schedule.id = study_schedule_content.schedule_instance_id
      AND app_private.has_module_related_org_scope(
        schedule.semester_id, 'publicity', schedule.org_id, NULL
      )
  )
);

DROP POLICY IF EXISTS "学委和宣委可查看共读影像" ON study_reading_media_assets;
CREATE POLICY "学委和宣委可查看共读影像"
ON study_reading_media_assets FOR SELECT
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
);

DROP POLICY IF EXISTS "学委可提交共读影像" ON study_reading_media_assets;
CREATE POLICY "学委可提交共读影像"
ON study_reading_media_assets FOR INSERT
TO authenticated
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  )
  AND submitted_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "学委可修改共读影像" ON study_reading_media_assets;
CREATE POLICY "学委可修改共读影像"
ON study_reading_media_assets FOR UPDATE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
)
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  )
  AND submitted_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "学委可删除共读影像" ON study_reading_media_assets;
CREATE POLICY "学委可删除共读影像"
ON study_reading_media_assets FOR DELETE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
);

DROP POLICY IF EXISTS "宣委可查看晨读长图" ON publicity_reading_posters;
CREATE POLICY "宣委可查看晨读长图"
ON publicity_reading_posters FOR SELECT
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
);

DROP POLICY IF EXISTS "宣委可创建晨读长图" ON publicity_reading_posters;
CREATE POLICY "宣委可创建晨读长图"
ON publicity_reading_posters FOR INSERT
TO authenticated
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  )
  AND created_by = (SELECT auth.uid())
  AND updated_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "宣委可修改晨读长图" ON publicity_reading_posters;
CREATE POLICY "宣委可修改晨读长图"
ON publicity_reading_posters FOR UPDATE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
)
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  )
  AND updated_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "宣委可删除晨读长图" ON publicity_reading_posters;
CREATE POLICY "宣委可删除晨读长图"
ON publicity_reading_posters FOR DELETE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
);
