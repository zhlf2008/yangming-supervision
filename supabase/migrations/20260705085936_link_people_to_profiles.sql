-- Link domain people records to login profiles explicitly. Phone remains a
-- bootstrap matcher, but authorization and account state use profile_id.

ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_profile_id_unique
ON public.people(profile_id)
WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_profile_lookup
ON public.people(profile_id, status);

UPDATE public.people AS person
SET profile_id = profile.id
FROM public.profiles AS profile
WHERE person.profile_id IS NULL
  AND NULLIF(REGEXP_REPLACE(COALESCE(person.phone, ''), '\D', '', 'g'), '') IS NOT NULL
  AND REGEXP_REPLACE(COALESCE(person.phone, ''), '\D', '', 'g')
      = REGEXP_REPLACE(COALESCE(profile.phone, ''), '\D', '', 'g')
  AND NOT EXISTS (
    SELECT 1
    FROM public.people AS linked
    WHERE linked.profile_id = profile.id
  );

CREATE OR REPLACE FUNCTION app_private.link_person_profile_by_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_profile_id UUID;
BEGIN
  IF NEW.profile_id IS NOT NULL OR NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\D', '', 'g'), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT profile.id
  INTO matched_profile_id
  FROM public.profiles AS profile
  WHERE REGEXP_REPLACE(COALESCE(profile.phone, ''), '\D', '', 'g')
        = REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\D', '', 'g')
    AND NOT EXISTS (
      SELECT 1
      FROM public.people AS linked
      WHERE linked.profile_id = profile.id
        AND linked.id IS DISTINCT FROM NEW.id
    )
  ORDER BY profile.created_at NULLS LAST, profile.id
  LIMIT 1;

  NEW.profile_id = matched_profile_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.link_profile_person_by_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\D', '', 'g'), '') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.people AS person
  SET profile_id = NEW.id
  WHERE person.profile_id IS NULL
    AND REGEXP_REPLACE(COALESCE(person.phone, ''), '\D', '', 'g')
        = REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\D', '', 'g')
    AND NOT EXISTS (
      SELECT 1
      FROM public.people AS linked
      WHERE linked.profile_id = NEW.id
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.link_person_profile_by_phone() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.link_profile_person_by_phone() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_link_person_profile_by_phone ON public.people;
CREATE TRIGGER trg_link_person_profile_by_phone
BEFORE INSERT OR UPDATE OF phone, profile_id ON public.people
FOR EACH ROW EXECUTE FUNCTION app_private.link_person_profile_by_phone();

DROP TRIGGER IF EXISTS trg_link_profile_person_by_phone ON public.profiles;
CREATE TRIGGER trg_link_profile_person_by_phone
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.link_profile_person_by_phone();
