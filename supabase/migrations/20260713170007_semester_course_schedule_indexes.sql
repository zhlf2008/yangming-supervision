CREATE INDEX IF NOT EXISTS idx_study_semester_course_schedule_course
ON public.study_semester_course_schedule(course_id)
WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_semester_course_schedule_creator
ON public.study_semester_course_schedule(created_by)
WHERE created_by IS NOT NULL;
