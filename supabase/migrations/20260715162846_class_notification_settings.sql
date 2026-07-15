ALTER TABLE organization_webhook_configs
  ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN reminder_start_time TEXT NOT NULL DEFAULT '12:00',
  ADD COLUMN reminder_end_time TEXT NOT NULL DEFAULT '20:00',
  ADD COLUMN reminder_interval_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN award_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN include_group_awards BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE organization_webhook_configs
  ADD CONSTRAINT organization_webhook_configs_reminder_start_time_check
    CHECK (reminder_start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT organization_webhook_configs_reminder_end_time_check
    CHECK (reminder_end_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT organization_webhook_configs_reminder_window_check
    CHECK (reminder_start_time < reminder_end_time),
  ADD CONSTRAINT organization_webhook_configs_reminder_interval_check
    CHECK (reminder_interval_minutes BETWEEN 15 AND 1440);

UPDATE organization_webhook_configs class_config
SET reminder_enabled = COALESCE(parent_config.enabled, FALSE),
    reminder_start_time = COALESCE(parent_config.start_time, '12:00'),
    reminder_end_time = COALESCE(parent_config.end_time, '20:00'),
    reminder_interval_minutes = GREATEST(15, LEAST(1440, COALESCE(parent_config.interval_minutes, 60))),
    award_enabled = COALESCE(parent_config.award_enabled, FALSE),
    include_group_awards = TRUE
FROM organizations class_org
LEFT JOIN reminder_configs parent_config
  ON parent_config.org_id = class_org.parent_id
WHERE class_config.org_id = class_org.id;

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_reminders
  ON organization_webhook_configs (semester_id, org_id)
  WHERE enabled = TRUE AND reminder_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_awards
  ON organization_webhook_configs (semester_id, org_id)
  WHERE enabled = TRUE AND award_enabled = TRUE;
