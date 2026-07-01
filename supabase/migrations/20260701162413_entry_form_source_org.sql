-- 保留公开进班申请的来源班级，供生活委按组织范围开展关怀。

ALTER TABLE public.entry_forms
ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entry_forms_org
ON public.entry_forms(org_id);
