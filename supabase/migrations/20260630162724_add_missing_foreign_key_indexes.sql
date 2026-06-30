create index if not exists idx_attendance_records_att_submitted_by
  on public.attendance_records (att_submitted_by);
create index if not exists idx_attendance_records_fill_user_id
  on public.attendance_records (fill_user_id);
create index if not exists idx_attendance_records_hw_submitted_by
  on public.attendance_records (hw_submitted_by);
create index if not exists idx_attendance_records_schedule_id
  on public.attendance_records (schedule_id);
create index if not exists idx_attendance_records_semester_id
  on public.attendance_records (semester_id);
create index if not exists idx_entry_forms_person_id
  on public.entry_forms (person_id);
create index if not exists idx_module_memberships_org_id
  on public.module_memberships (org_id);
create index if not exists idx_organizations_area_id
  on public.organizations (area_id);
create index if not exists idx_organizations_parent_id
  on public.organizations (parent_id);
create index if not exists idx_person_org_assignments_org_id
  on public.person_org_assignments (org_id);
create index if not exists idx_person_positions_org_id
  on public.person_positions (org_id);
create index if not exists idx_person_positions_person_id
  on public.person_positions (person_id);
create index if not exists idx_profiles_organization_id
  on public.profiles (organization_id);
create index if not exists idx_study_assignment_demands_created_by
  on public.study_assignment_demands (created_by);
create index if not exists idx_study_assignment_demands_from_org_id
  on public.study_assignment_demands (from_org_id);
create index if not exists idx_study_assignment_people_created_by
  on public.study_assignment_people (created_by);
create index if not exists idx_study_assignment_people_person_id
  on public.study_assignment_people (person_id);
create index if not exists idx_study_course_library_created_by
  on public.study_course_library (created_by);
create index if not exists idx_study_notification_templates_org_id
  on public.study_notification_templates (org_id);
create index if not exists idx_study_notification_templates_updated_by
  on public.study_notification_templates (updated_by);
create index if not exists idx_study_reading_type_positions_created_by
  on public.study_reading_type_positions (created_by);
create index if not exists idx_study_reading_type_roles_created_by
  on public.study_reading_type_roles (created_by);
create index if not exists idx_study_reading_type_roles_org_id
  on public.study_reading_type_roles (org_id);
create index if not exists idx_study_reading_type_roles_role_id
  on public.study_reading_type_roles (role_id);
create index if not exists idx_study_reading_types_created_by
  on public.study_reading_types (created_by);
create index if not exists idx_study_reading_types_org_id
  on public.study_reading_types (org_id);
create index if not exists idx_study_roles_created_by
  on public.study_roles (created_by);
create index if not exists idx_study_roles_org_id
  on public.study_roles (org_id);
create index if not exists idx_study_schedule_content_course_id
  on public.study_schedule_content (course_id);
create index if not exists idx_study_schedule_content_created_by
  on public.study_schedule_content (created_by);
create index if not exists idx_study_schedule_instances_course_id
  on public.study_schedule_instances (course_id);
create index if not exists idx_study_schedule_instances_created_by
  on public.study_schedule_instances (created_by);
create index if not exists idx_study_schedule_instances_org_id
  on public.study_schedule_instances (org_id);
create index if not exists idx_study_schedule_instances_reading_type_id
  on public.study_schedule_instances (reading_type_id);
create index if not exists idx_study_schedule_rules_created_by
  on public.study_schedule_rules (created_by);
create index if not exists idx_study_schedule_rules_org_id
  on public.study_schedule_rules (org_id);
create index if not exists idx_study_schedule_rules_reading_type_id
  on public.study_schedule_rules (reading_type_id);
