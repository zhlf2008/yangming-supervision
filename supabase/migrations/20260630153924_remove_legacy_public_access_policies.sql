-- Remove legacy permissive policies that bypass the scoped policies added by
-- later migrations. Keep only the minimum anonymous reads required to render
-- the public entry form.

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to areas" ON public.areas;
DROP POLICY IF EXISTS "Allow all access to assessment_types" ON public.assessment_types;
DROP POLICY IF EXISTS "Allow all access to attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Allow all access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all access to schedules" ON public.schedules;
DROP POLICY IF EXISTS "Allow all access to semesters" ON public.semesters;

REVOKE ALL ON TABLE public.areas FROM anon, authenticated;
REVOKE ALL ON TABLE public.assessment_types FROM anon, authenticated;
REVOKE ALL ON TABLE public.attendance_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.organizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.schedules FROM anon, authenticated;
REVOKE ALL ON TABLE public.semesters FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessment_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.semesters TO authenticated;

DROP POLICY IF EXISTS "外部表单可查看当前学期" ON public.semesters;
CREATE POLICY "外部表单可查看当前学期"
ON public.semesters
FOR SELECT
TO anon
USING (is_current = 1);

DROP POLICY IF EXISTS "外部表单可查看当前学期有效组织" ON public.organizations;
CREATE POLICY "外部表单可查看当前学期有效组织"
ON public.organizations
FOR SELECT
TO anon
USING (
  is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM public.semesters s
    WHERE s.id = organizations.semester_id
      AND s.is_current = 1
  )
);

GRANT SELECT ON TABLE public.semesters TO anon;
GRANT SELECT ON TABLE public.organizations TO anon;

-- Opt out of the legacy default that exposes future public tables
-- automatically. New migrations must grant their API privileges explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;
