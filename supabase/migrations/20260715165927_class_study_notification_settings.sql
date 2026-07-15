ALTER TABLE public.organization_webhook_configs
  ADD COLUMN study_daily_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN study_weekly_course_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN study_weekly_assignment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN study_notice_settings JSONB NOT NULL DEFAULT '{
    "daily_send_time": "20:00",
    "daily_lead_days": 1,
    "weekly_course_weekday": 7,
    "weekly_course_send_time": "20:00",
    "weekly_assignment_weekday": 4,
    "weekly_assignment_send_time": "20:00",
    "default_start_time": "06:00",
    "default_end_time": "07:00",
    "bigclass_end_time": "07:30",
    "teaching_covenant_title": "传习课堂教约",
    "teaching_covenant_url": "https://mp.weixin.qq.com/s/yOoMV5TEOacQMBVK8JDwVQ",
    "group_meeting_info": "",
    "class_meeting_info": "",
    "bigclass_meeting_info": "",
    "footer": "分享人员请提前准备；请提前5至10分钟进入会议室，穿班服、统一背景、全程开启摄像头。"
  }'::JSONB;

ALTER TABLE public.organization_webhook_configs
  ADD CONSTRAINT organization_webhook_configs_study_notice_settings_check
    CHECK (JSONB_TYPEOF(study_notice_settings) = 'object');

CREATE INDEX IF NOT EXISTS idx_organization_webhook_configs_study_notifications
  ON public.organization_webhook_configs (semester_id, org_id)
  WHERE enabled = TRUE
    AND (
      study_daily_enabled = TRUE
      OR study_weekly_course_enabled = TRUE
      OR study_weekly_assignment_enabled = TRUE
    );
