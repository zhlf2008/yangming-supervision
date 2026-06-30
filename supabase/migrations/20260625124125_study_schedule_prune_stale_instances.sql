-- ============================================================
-- 学委日程清理：删除与当前大班规则不匹配的空历史实例
-- Execute after 20260625121436_study_schedule_backfill_org_nodes.sql.
-- ============================================================

WITH mapped AS (
  SELECT
    si.id,
    si.semester_id,
    si.schedule_date,
    si.scope_level,
    CASE
      WHEN org.level = '大班' THEN org.id
      WHEN org.level = '班级' THEN org.parent_id
      WHEN org.level = '小组' THEN cls.parent_id
    END AS big_class_id
  FROM study_schedule_instances si
  JOIN organizations org ON org.id = si.org_id
  LEFT JOIN organizations cls ON cls.id = org.parent_id
),
stale AS (
  SELECT mapped.id
  FROM mapped
  JOIN study_schedule_rules rule
    ON rule.semester_id = mapped.semester_id
   AND rule.org_id = mapped.big_class_id
   AND rule.weekday = EXTRACT(ISODOW FROM mapped.schedule_date)::INTEGER
   AND rule.is_active = TRUE
  WHERE mapped.scope_level <> rule.scope_level
),
safe_delete AS (
  SELECT stale.id
  FROM stale
  WHERE NOT EXISTS (
    SELECT 1
    FROM study_assignment_demands d
    WHERE d.schedule_instance_id = stale.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM study_schedule_content c
    WHERE c.schedule_instance_id = stale.id
  )
)
DELETE FROM study_schedule_instances si
USING safe_delete
WHERE si.id = safe_delete.id;
