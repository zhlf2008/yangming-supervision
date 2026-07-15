CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_org_id
  ON organization_webhook_configs (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_created_by
  ON organization_webhook_configs (created_by);

CREATE INDEX IF NOT EXISTS idx_organization_notification_outbox_org_id
  ON organization_notification_outbox (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_notification_outbox_created_by
  ON organization_notification_outbox (created_by);
