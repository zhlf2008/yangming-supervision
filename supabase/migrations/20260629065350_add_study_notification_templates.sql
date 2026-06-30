CREATE TABLE IF NOT EXISTS study_notification_templates (
  id BIGSERIAL PRIMARY KEY,
  semester_id BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title_template TEXT NOT NULL DEFAULT '【{组织}】第{周次}周共读安排',
  intro_text TEXT NOT NULL DEFAULT '',
  closing_text TEXT NOT NULL DEFAULT '',
  show_course BOOLEAN NOT NULL DEFAULT TRUE,
  show_roster BOOLEAN NOT NULL DEFAULT TRUE,
  show_question BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT study_notification_templates_semester_org_key UNIQUE (semester_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_study_notification_templates_org
ON study_notification_templates(semester_id, org_id);

ALTER TABLE study_notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "学委可查看通知模板" ON study_notification_templates;
CREATE POLICY "学委可查看通知模板" ON study_notification_templates FOR SELECT
  TO authenticated
  USING (
    app_private.has_module_access(
      semester_id,
      'study',
      ARRAY['学委', '副学委', '管理员', 'admin', 'manager']
    )
  );

DROP POLICY IF EXISTS "本级学委可管理通知模板" ON study_notification_templates;
CREATE POLICY "本级学委可管理通知模板" ON study_notification_templates FOR ALL
  TO authenticated
  USING (
    app_private.has_study_membership_at_org(
      semester_id,
      org_id,
      ARRAY['学委', '副学委', '管理员', 'admin', 'manager']
    )
  )
  WITH CHECK (
    app_private.has_study_membership_at_org(
      semester_id,
      org_id,
      ARRAY['学委', '副学委', '管理员', 'admin', 'manager']
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON study_notification_templates TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE study_notification_templates_id_seq TO authenticated, service_role;
