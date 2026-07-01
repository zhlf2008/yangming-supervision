-- 补齐生活委与组织委工作流外键索引。

CREATE INDEX IF NOT EXISTS idx_life_care_records_org
ON public.life_care_records(org_id);

CREATE INDEX IF NOT EXISTS idx_organization_activities_org
ON public.organization_activities(org_id);
