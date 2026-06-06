-- ============================================================
-- 1. attendance_records 新增 section 级别提交时间和提交人
-- ============================================================
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS att_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS att_submitted_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS hw_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hw_submitted_by uuid REFERENCES profiles(id);

-- ============================================================
-- 2. assessment_deadline_configs：day_of_week 改为 days_of_week 多选
-- ============================================================

-- 2a. 删旧唯一约束
DO $$ BEGIN
  ALTER TABLE assessment_deadline_configs DROP CONSTRAINT IF EXISTS assessment_deadline_configs_assessment_type_id_org_id_day_of__key;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2b. 删旧索引（如果约束是通过 UNIQUE INDEX 创建的）
DROP INDEX IF EXISTS assessment_deadline_configs_assessment_type_id_org_id_day_of__key;

-- 2c. 加新列
ALTER TABLE assessment_deadline_configs ADD COLUMN IF NOT EXISTS days_of_week TEXT;

-- 2d. 将旧 day_of_week 数据迁移到 days_of_week
UPDATE assessment_deadline_configs
  SET days_of_week = day_of_week::TEXT
  WHERE days_of_week IS NULL;

-- 2e. 删除旧列
ALTER TABLE assessment_deadline_configs DROP COLUMN IF EXISTS day_of_week;

-- 2f. 设 NOT NULL
ALTER TABLE assessment_deadline_configs ALTER COLUMN days_of_week SET NOT NULL;

-- 2g. 新唯一约束：同一考核项目 + 大班只能有一条规则（覆盖多天）
DO $$ BEGIN
  ALTER TABLE assessment_deadline_configs ADD CONSTRAINT assessment_deadline_configs_type_org_unique
    UNIQUE (assessment_type_id, org_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
