-- ============================================================
-- 阳明心学督察管理系统 —— 数据库约束迁移 SQL
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. attendance_records 唯一约束：同小组同一天仅一条记录
-- 先检查是否已存在重复数据
SELECT schedule_id, organization_id, COUNT(*) as cnt
FROM attendance_records
GROUP BY schedule_id, organization_id
HAVING COUNT(*) > 1;

-- 如果存在重复，先清理（保留最新一条）
-- DELETE FROM attendance_records a
-- USING attendance_records b
-- WHERE a.created_at < b.created_at
--   AND a.schedule_id = b.schedule_id
--   AND a.organization_id = b.organization_id;

-- 添加唯一索引（如果不存在）
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
ON attendance_records (schedule_id, organization_id);

-- 2. schedules 唯一约束：同一学期同一天仅一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique
ON schedules (semester_id, schedule_date);

-- 3. profiles 表添加 organization_id 外键
-- DO $$ BEGIN
--   ALTER TABLE profiles
--   ADD CONSTRAINT fk_profiles_organization
--   FOREIGN KEY (organization_id) REFERENCES organizations(id);
-- EXCEPTION WHEN duplicate_object THEN NULL;
-- END $$;

-- 4. attendance_records 表相关外键
-- DO $$ BEGIN
--   ALTER TABLE attendance_records
--   ADD CONSTRAINT fk_attendance_schedule
--   FOREIGN KEY (schedule_id) REFERENCES schedules(id);
-- EXCEPTION WHEN duplicate_object THEN NULL;
-- END $$;
