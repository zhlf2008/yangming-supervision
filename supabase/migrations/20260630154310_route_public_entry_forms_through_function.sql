-- Public submissions now go through the entry-form-submit Edge Function,
-- which validates and normalizes the payload before using the service role.

DROP POLICY IF EXISTS "外部可提交进班表单" ON public.entry_forms;

CREATE POLICY "秘书处可新增进班表单"
ON public.entry_forms
FOR INSERT
TO authenticated
WITH CHECK (
  person_id IS NULL
  AND COALESCE(status, 'active') = 'active'
  AND app_private.has_module_access(semester_id, 'secretariat', NULL)
);

REVOKE INSERT ON TABLE public.entry_forms FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.entry_forms TO authenticated;
