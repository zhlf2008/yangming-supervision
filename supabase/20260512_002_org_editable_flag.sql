-- 为 semesters 表添加组织架构编辑开关
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS org_editable BOOLEAN DEFAULT TRUE;
