-- ============================================================
-- 软归档补充：添加 archived_at 时间戳，支持按日期切断历史数据
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
