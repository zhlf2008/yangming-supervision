-- ============================================================
-- 每周获奖推送配置
-- 在 reminder_configs 表添加 award_enabled 字段
-- ============================================================

ALTER TABLE reminder_configs ADD COLUMN IF NOT EXISTS award_enabled boolean NOT NULL DEFAULT false;
