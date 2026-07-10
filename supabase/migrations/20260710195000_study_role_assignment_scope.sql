-- 共读类型岗位：区分承办组织专属与全体参与组织岗位。
-- 既有岗位保留逐项分配，避免迁移后改变已配置日程。

ALTER TABLE public.study_reading_type_positions
  ADD COLUMN IF NOT EXISTS assignment_scope TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.study_reading_type_positions
  DROP CONSTRAINT IF EXISTS study_reading_type_positions_assignment_scope_check;

ALTER TABLE public.study_reading_type_positions
  ADD CONSTRAINT study_reading_type_positions_assignment_scope_check
  CHECK (assignment_scope IN ('manual', 'organizer', 'all_participants'));

ALTER TABLE public.study_schedule_instances
  ADD COLUMN IF NOT EXISTS organizer_org_id BIGINT
  REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_schedule_instances_organizer_org
  ON public.study_schedule_instances(organizer_org_id)
  WHERE organizer_org_id IS NOT NULL;

COMMENT ON COLUMN public.study_reading_type_positions.assignment_scope IS
  'manual=逐项分配，organizer=承办组织安排，all_participants=每个参与组织均需安排';

COMMENT ON COLUMN public.study_schedule_instances.organizer_org_id IS
  '本日日程的承办班级或小组；用于自动分配承办组织专属岗位';
