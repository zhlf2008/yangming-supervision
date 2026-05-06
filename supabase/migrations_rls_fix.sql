-- ============================================================
-- RLS 修复：开启 organizations 和 profiles 表的 RLS
-- 这两个表已有 RLS policy，但未启用 RLS
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
