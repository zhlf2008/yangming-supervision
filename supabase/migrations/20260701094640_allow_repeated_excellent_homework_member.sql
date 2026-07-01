-- 同一成员可能在同一日提交多篇优秀作业，三条填报只按槽位保持唯一。
DROP INDEX IF EXISTS public.idx_excellent_homework_person_per_day;
