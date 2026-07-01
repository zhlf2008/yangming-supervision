-- 进班表单“下次生日”字段与生活委关怀数据源对齐。

UPDATE public.entry_forms
SET next_birthday = birthday_date,
    updated_at = NOW()
WHERE next_birthday IS NULL
  AND birthday_date IS NOT NULL;
