-- A schedule may reference multiple courses with the same sort order.
DROP INDEX IF EXISTS idx_study_schedule_content_order_unique;
