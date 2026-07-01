-- 生活委、组织委职务与模块权限自动同步。

CREATE OR REPLACE FUNCTION app_private.sync_committee_position_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_position public.person_positions%ROWTYPE;
  target_user_id UUID;
  target_module TEXT;
  target_role TEXT;
BEGIN
  source_position = COALESCE(NEW, OLD);

  IF source_position.position_name ILIKE '%生活委%' THEN
    target_module = 'life';
    target_role = CASE
      WHEN source_position.position_name ILIKE '%总生活委%' THEN '总生活委'
      ELSE '生活委'
    END;
  ELSIF source_position.position_name ILIKE '%组织委%' THEN
    target_module = 'organization';
    target_role = CASE
      WHEN source_position.position_name ILIKE '%总组织委%' THEN '总组织委'
      ELSE '组织委'
    END;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT profile.id
  INTO target_user_id
  FROM public.people person
  JOIN public.profiles profile ON profile.phone = person.phone
  WHERE person.id = source_position.person_id
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' OR NEW.is_active IS NOT TRUE THEN
    UPDATE public.module_memberships
    SET enabled = FALSE, updated_at = NOW()
    WHERE user_id = target_user_id
      AND semester_id = source_position.semester_id
      AND module_key = target_module
      AND org_id = source_position.org_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.module_memberships (
    user_id, semester_id, module_key, role, org_id, enabled
  )
  VALUES (
    target_user_id, NEW.semester_id, target_module, target_role, NEW.org_id, TRUE
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.module_memberships
  SET enabled = TRUE, updated_at = NOW()
  WHERE user_id = target_user_id
    AND semester_id = NEW.semester_id
    AND module_key = target_module
    AND org_id = NEW.org_id
    AND role = target_role;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.sync_committee_position_membership() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_committee_position_membership ON public.person_positions;
CREATE TRIGGER trg_sync_committee_position_membership
AFTER INSERT OR UPDATE OR DELETE ON public.person_positions
FOR EACH ROW EXECUTE FUNCTION app_private.sync_committee_position_membership();

CREATE OR REPLACE FUNCTION app_private.sync_committee_profile_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.module_memberships (
    user_id, semester_id, module_key, role, org_id, enabled
  )
  SELECT DISTINCT
    NEW.id,
    position.semester_id,
    CASE
      WHEN position.position_name ILIKE '%生活委%' THEN 'life'
      ELSE 'organization'
    END,
    CASE
      WHEN position.position_name ILIKE '%总生活委%' THEN '总生活委'
      WHEN position.position_name ILIKE '%生活委%' THEN '生活委'
      WHEN position.position_name ILIKE '%总组织委%' THEN '总组织委'
      ELSE '组织委'
    END,
    position.org_id,
    TRUE
  FROM public.people person
  JOIN public.person_positions position
    ON position.person_id = person.id
   AND position.is_active = TRUE
  WHERE person.phone = NEW.phone
    AND position.org_id IS NOT NULL
    AND (
      position.position_name ILIKE '%生活委%'
      OR position.position_name ILIKE '%组织委%'
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.sync_committee_profile_memberships() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_committee_profile_memberships ON public.profiles;
CREATE TRIGGER trg_sync_committee_profile_memberships
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.sync_committee_profile_memberships();
