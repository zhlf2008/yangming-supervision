-- 将长图裁切取景框作为正式素材配置保存，避免刷新、重新进入或跨设备后丢失。
ALTER TABLE public.publicity_reading_poster_items
  ADD COLUMN IF NOT EXISTS crop_frame JSONB;

ALTER TABLE public.publicity_reading_poster_items
  DROP CONSTRAINT IF EXISTS publicity_reading_poster_items_crop_frame_valid;

ALTER TABLE public.publicity_reading_poster_items
  ADD CONSTRAINT publicity_reading_poster_items_crop_frame_valid
  CHECK (
    crop_frame IS NULL
    OR (
      jsonb_typeof(crop_frame) = 'object'
      AND crop_frame ?& ARRAY['left', 'top', 'right', 'bottom']
      AND (crop_frame->>'left')::numeric BETWEEN 0 AND 100
      AND (crop_frame->>'top')::numeric BETWEEN 0 AND 100
      AND (crop_frame->>'right')::numeric BETWEEN 0 AND 100
      AND (crop_frame->>'bottom')::numeric BETWEEN 0 AND 100
      AND (crop_frame->>'left')::numeric < (crop_frame->>'right')::numeric
      AND (crop_frame->>'top')::numeric < (crop_frame->>'bottom')::numeric
    )
  );
