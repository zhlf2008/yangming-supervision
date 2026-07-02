-- 宣委可为每篇优秀作业从原文中选择一句金句，用于班级/小组长图。
ALTER TABLE public.publicity_homework_card_items
ADD COLUMN IF NOT EXISTS highlight_text TEXT;

ALTER TABLE public.publicity_homework_card_items
DROP CONSTRAINT IF EXISTS publicity_homework_card_items_highlight_text_length;

ALTER TABLE public.publicity_homework_card_items
ADD CONSTRAINT publicity_homework_card_items_highlight_text_length
CHECK (highlight_text IS NULL OR LENGTH(BTRIM(highlight_text)) BETWEEN 1 AND 500);

COMMENT ON COLUMN public.publicity_homework_card_items.highlight_text
IS '宣委从对应优秀作业原文中选择的金句；为空时长图仅展示原文。';
