ALTER TABLE public.publicity_reading_posters
ADD COLUMN IF NOT EXISTS style_config JSONB NOT NULL DEFAULT '{
  "cover_mode": "text",
  "accent_color": "vermillion",
  "title_scale": "medium",
  "photo_radius": 0,
  "section_spacing": "normal"
}'::JSONB;

ALTER TABLE public.publicity_reading_posters
DROP CONSTRAINT IF EXISTS publicity_reading_posters_style_config_check;

ALTER TABLE public.publicity_reading_posters
ADD CONSTRAINT publicity_reading_posters_style_config_check
CHECK (JSONB_TYPEOF(style_config) = 'object');

UPDATE public.publicity_reading_posters poster
SET style_config = JSONB_SET(poster.style_config, '{cover_mode}', '"image"'::JSONB, TRUE)
WHERE EXISTS (
  SELECT 1
  FROM public.publicity_reading_poster_items item
  WHERE item.poster_id = poster.id
    AND item.slot_kind = 'feature'
    AND item.is_visible = TRUE
);

COMMENT ON COLUMN public.publicity_reading_posters.style_config IS
'每日共读长图样式参数：封面模式、主色、标题字号、照片圆角和区块间距。';
