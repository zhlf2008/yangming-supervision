-- 宣委可在长图中修正展示用岗位、姓名，不回写学委提交的原始影像资料。
ALTER TABLE public.publicity_reading_poster_items
  ADD COLUMN IF NOT EXISTS role_name_override TEXT,
  ADD COLUMN IF NOT EXISTS person_name_override TEXT;
