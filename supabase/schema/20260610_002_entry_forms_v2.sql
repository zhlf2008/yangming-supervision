-- ============================================================
-- 进班表单字段优化：生日农历支持、省市县、职业分类等
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 生日：拆分日期+历法类型
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS birthday_date DATE;
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS birthday_type TEXT DEFAULT 'solar';
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS next_birthday DATE;

-- 2. 地址：省市县三级
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS district TEXT;

-- 重命名旧的 city 字段为 city_old（兼容）
ALTER TABLE entry_forms RENAME COLUMN city TO city_old;
ALTER TABLE entry_forms ALTER COLUMN city_old DROP NOT NULL;

-- 3. 职业：大类单选
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS occupation_category TEXT;
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS occupation_other TEXT;
ALTER TABLE entry_forms DROP COLUMN IF EXISTS occupation;

-- 4. 职业新增：position_type（企业主/职员等）
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS position_type TEXT;

-- 5. 学员类型：改为多选项
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS student_type TEXT;
ALTER TABLE entry_forms DROP COLUMN IF EXISTS is_new_student;

-- 6. 已有 birth_date 的数据迁移到 birthday_date
UPDATE entry_forms SET birthday_date = birth_date, birthday_type = 'solar' WHERE birth_date IS NOT NULL AND birthday_date IS NULL;
ALTER TABLE entry_forms DROP COLUMN IF EXISTS birth_date;

-- 索引补充
CREATE INDEX IF NOT EXISTS idx_entry_forms_province ON entry_forms(province);
CREATE INDEX IF NOT EXISTS idx_entry_forms_student_type ON entry_forms(student_type);
CREATE INDEX IF NOT EXISTS idx_entry_forms_occupation ON entry_forms(occupation_category);
CREATE INDEX IF NOT EXISTS idx_entry_forms_position ON entry_forms(position_type);
