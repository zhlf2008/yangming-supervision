ALTER TABLE public.study_notification_templates
ADD COLUMN IF NOT EXISTS notice_settings JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.study_notification_templates.notice_settings IS
'组织级晨读通知设置，包括发送计划、共读时间、教约、会议地址等。';
