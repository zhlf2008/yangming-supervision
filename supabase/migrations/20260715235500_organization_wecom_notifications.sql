CREATE TABLE IF NOT EXISTS organization_webhook_configs (
  id BIGSERIAL PRIMARY KEY,
  semester_id BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_webhook_configs_semester_org_key UNIQUE (semester_id, org_id),
  CONSTRAINT organization_webhook_configs_wecom_url_check CHECK (
    webhook_url ~ '^https://qyapi\.weixin\.qq\.com/cgi-bin/webhook/send\?key=[A-Za-z0-9_-]+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_enabled
  ON organization_webhook_configs (semester_id, org_id)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_org_id
  ON organization_webhook_configs (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_created_by
  ON organization_webhook_configs (created_by);

ALTER TABLE organization_webhook_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "秘书处可查看班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可查看班级群机器人配置"
  ON organization_webhook_configs FOR SELECT
  TO authenticated
  USING (app_private.has_secretariat_org_scope(semester_id, org_id));

DROP POLICY IF EXISTS "秘书处可管理班级群机器人配置" ON organization_webhook_configs;
DROP POLICY IF EXISTS "秘书处可新增班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可新增班级群机器人配置"
  ON organization_webhook_configs FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_secretariat_org_scope(semester_id, org_id));

DROP POLICY IF EXISTS "秘书处可更新班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可更新班级群机器人配置"
  ON organization_webhook_configs FOR UPDATE
  TO authenticated
  USING (app_private.has_secretariat_org_scope(semester_id, org_id))
  WITH CHECK (app_private.has_secretariat_org_scope(semester_id, org_id));

DROP POLICY IF EXISTS "秘书处可删除班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可删除班级群机器人配置"
  ON organization_webhook_configs FOR DELETE
  TO authenticated
  USING (app_private.has_secretariat_org_scope(semester_id, org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_webhook_configs TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE organization_webhook_configs_id_seq TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS organization_notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  semester_id BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  wecom_response JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_notification_outbox_dedupe
  ON organization_notification_outbox (semester_id, org_id, module_key, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_notification_outbox_pending
  ON organization_notification_outbox (available_at, id)
  WHERE status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS idx_organization_notification_outbox_org_id
  ON organization_notification_outbox (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_notification_outbox_created_by
  ON organization_notification_outbox (created_by);

ALTER TABLE organization_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "模块成员可查看本级班级通知" ON organization_notification_outbox;
CREATE POLICY "模块成员可查看本级班级通知"
  ON organization_notification_outbox FOR SELECT
  TO authenticated
  USING (
    app_private.has_secretariat_org_scope(semester_id, org_id)
    OR app_private.has_module_org_scope(semester_id, module_key, org_id)
  );

DROP POLICY IF EXISTS "模块成员可创建本级班级通知" ON organization_notification_outbox;
CREATE POLICY "模块成员可创建本级班级通知"
  ON organization_notification_outbox FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.has_secretariat_org_scope(semester_id, org_id)
    OR app_private.has_module_org_scope(semester_id, module_key, org_id)
  );

GRANT SELECT, INSERT ON organization_notification_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_notification_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE organization_notification_outbox_id_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.validate_class_notification_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE organization.id = NEW.org_id
      AND organization.semester_id = NEW.semester_id
      AND organization.level = '班级'
  ) THEN
    RAISE EXCEPTION '通知目标必须是同一学期内的班级'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_organization_webhook_config ON organization_webhook_configs;
CREATE TRIGGER trg_validate_organization_webhook_config
  BEFORE INSERT OR UPDATE ON organization_webhook_configs
  FOR EACH ROW EXECUTE FUNCTION app_private.validate_class_notification_target();

DROP TRIGGER IF EXISTS trg_validate_organization_notification_outbox ON organization_notification_outbox;
CREATE TRIGGER trg_validate_organization_notification_outbox
  BEFORE INSERT OR UPDATE ON organization_notification_outbox
  FOR EACH ROW EXECUTE FUNCTION app_private.validate_class_notification_target();

CREATE OR REPLACE FUNCTION public.claim_organization_notifications(batch_size INTEGER DEFAULT 20)
RETURNS TABLE (
  id BIGINT,
  org_id BIGINT,
  title TEXT,
  content TEXT,
  webhook_url TEXT,
  attempt_count SMALLINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT notification.id
    FROM public.organization_notification_outbox notification
    JOIN public.organization_webhook_configs config
      ON config.semester_id = notification.semester_id
     AND config.org_id = notification.org_id
     AND config.enabled = TRUE
    WHERE notification.attempt_count < 5
      AND notification.available_at <= NOW()
      AND (
        notification.status IN ('pending', 'failed')
        OR (
          notification.status = 'processing'
          AND notification.locked_at < NOW() - INTERVAL '10 minutes'
        )
      )
    ORDER BY notification.available_at, notification.id
    FOR UPDATE OF notification SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size, 1), 50)
  ), claimed AS (
    UPDATE public.organization_notification_outbox notification
    SET status = 'processing',
        attempt_count = notification.attempt_count + 1,
        locked_at = NOW(),
        updated_at = NOW()
    FROM candidates
    WHERE notification.id = candidates.id
    RETURNING notification.*
  )
  SELECT claimed.id,
         claimed.org_id,
         claimed.title,
         claimed.content,
         config.webhook_url,
         claimed.attempt_count
  FROM claimed
  JOIN public.organization_webhook_configs config
    ON config.semester_id = claimed.semester_id
   AND config.org_id = claimed.org_id
   AND config.enabled = TRUE
  ORDER BY claimed.id;
$$;

CREATE OR REPLACE FUNCTION public.complete_organization_notification(
  notification_id BIGINT,
  succeeded BOOLEAN,
  response_payload JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.organization_notification_outbox notification
  SET status = CASE
        WHEN succeeded THEN 'sent'
        WHEN notification.attempt_count >= 5 THEN 'dead'
        ELSE 'failed'
      END,
      sent_at = CASE WHEN succeeded THEN NOW() ELSE NULL END,
      locked_at = NULL,
      last_error = CASE WHEN succeeded THEN NULL ELSE LEFT(COALESCE(error_message, '发送失败'), 1000) END,
      wecom_response = response_payload,
      updated_at = NOW()
  WHERE notification.id = notification_id
    AND notification.status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_organization_notifications(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_organization_notifications(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.complete_organization_notification(BIGINT, BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_organization_notification(BIGINT, BOOLEAN, JSONB, TEXT) TO service_role;
