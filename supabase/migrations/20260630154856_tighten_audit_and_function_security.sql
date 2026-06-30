-- Lock trigger helper lookup paths and make audit inserts attributable to the
-- signed-in user. Public bucket objects remain readable through public URLs,
-- so listing access is unnecessary.

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_module_memberships_updated_at() SET search_path = public;
ALTER FUNCTION public.update_entry_forms_updated_at() SET search_path = public;

DROP POLICY IF EXISTS "认证用户可插入日志" ON public.audit_logs;
CREATE POLICY "认证用户可插入自己的日志"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, DELETE ON TABLE public.audit_logs TO authenticated;
REVOKE ALL ON SEQUENCE public.audit_logs_id_seq FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;

DROP POLICY IF EXISTS "认证用户可查看课程封面" ON storage.objects;
