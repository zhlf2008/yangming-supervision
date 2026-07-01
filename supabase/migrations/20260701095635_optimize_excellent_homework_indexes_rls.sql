-- 覆盖外键查询，并避免 auth.uid() 在每行策略计算中重复求值。
CREATE INDEX IF NOT EXISTS idx_excellent_homework_org
ON public.excellent_homework_entries(org_id);

CREATE INDEX IF NOT EXISTS idx_excellent_homework_person
ON public.excellent_homework_entries(person_id);

CREATE INDEX IF NOT EXISTS idx_excellent_homework_submitted_by
ON public.excellent_homework_entries(submitted_by);

CREATE INDEX IF NOT EXISTS idx_publicity_cards_org
ON public.publicity_homework_cards(org_id);

CREATE INDEX IF NOT EXISTS idx_publicity_cards_created_by
ON public.publicity_homework_cards(created_by);

CREATE INDEX IF NOT EXISTS idx_publicity_cards_updated_by
ON public.publicity_homework_cards(updated_by);

ALTER POLICY "学委可填报优秀作业"
ON public.excellent_homework_entries
WITH CHECK (
  app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  AND submitted_by = (SELECT auth.uid())
);

ALTER POLICY "学委可修改优秀作业"
ON public.excellent_homework_entries
USING (
  app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
)
WITH CHECK (
  app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  AND submitted_by = (SELECT auth.uid())
);

ALTER POLICY "宣委可创建宣发卡片"
ON public.publicity_homework_cards
WITH CHECK (
  app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  AND created_by = (SELECT auth.uid())
  AND updated_by = (SELECT auth.uid())
);

ALTER POLICY "宣委可修改宣发卡片"
ON public.publicity_homework_cards
USING (
  app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
)
WITH CHECK (
  app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  AND updated_by = (SELECT auth.uid())
);
