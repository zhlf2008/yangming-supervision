-- 学期隔离：为 organizations 和 assessment_types 添加 semester_id
-- 使组织架构和考核项目按学期隔离

-- 1. 添加列（先可空，回填后设 NOT NULL）
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS semester_id BIGINT;
ALTER TABLE assessment_types ADD COLUMN IF NOT EXISTS semester_id BIGINT;

-- 2. 回填：用 is_current=1 的学期填充已有数据
UPDATE organizations
  SET semester_id = (SELECT id FROM semesters WHERE is_current = 1 LIMIT 1)
  WHERE semester_id IS NULL;

UPDATE assessment_types
  SET semester_id = (SELECT id FROM semesters WHERE is_current = 1 LIMIT 1)
  WHERE semester_id IS NULL;

-- 3. 设 NOT NULL 约束
ALTER TABLE organizations ALTER COLUMN semester_id SET NOT NULL;
ALTER TABLE assessment_types ALTER COLUMN semester_id SET NOT NULL;

-- 4. 可选：同一学期内组织名+父级唯一，避免重名
-- ALTER TABLE organizations ADD CONSTRAINT uq_org_semester_name UNIQUE (semester_id, parent_id, name);
