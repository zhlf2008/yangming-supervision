-- entry_forms 加手机号字段
ALTER TABLE entry_forms ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_entry_forms_phone ON entry_forms(phone);
