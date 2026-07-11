-- 前端裁切允许缩小到 0.2 倍，数据库约束须与编辑器保持一致。
ALTER TABLE public.publicity_reading_poster_items
  DROP CONSTRAINT IF EXISTS publicity_reading_poster_items_crop_zoom_check;

ALTER TABLE public.publicity_reading_poster_items
  ADD CONSTRAINT publicity_reading_poster_items_crop_zoom_check
  CHECK (crop_zoom BETWEEN 0.2 AND 4);
