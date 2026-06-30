-- ============================================================
-- 学委日程回填：旧全局规则 -> 大班规则，并补齐所有组织节点日程
-- Execute after 20260625102913_study_workflow_v2.sql.
-- ============================================================

-- 1. 把历史 org_id 为空的全局周规则复制为每个大班自己的规则。
INSERT INTO study_schedule_rules (
  semester_id,
  org_id,
  weekday,
  scope_level,
  title,
  is_active,
  created_at,
  updated_at
)
SELECT
  r.semester_id,
  bc.id AS org_id,
  r.weekday,
  r.scope_level,
  r.title,
  r.is_active,
  NOW(),
  NOW()
FROM study_schedule_rules r
JOIN organizations bc
  ON bc.semester_id = r.semester_id
 AND bc.level = '大班'
WHERE r.org_id IS NULL
ON CONFLICT (semester_id, org_id, weekday)
DO UPDATE SET
  scope_level = EXCLUDED.scope_level,
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. 按大班规则补齐大班、班级、小组每个组织节点的日程实例。
WITH rule_rows AS (
  SELECT
    r.semester_id,
    r.org_id AS big_class_id,
    r.weekday,
    r.scope_level,
    r.title,
    COALESCE(s.trial_start_date, s.start_date) AS start_date,
    s.end_date
  FROM study_schedule_rules r
  JOIN semesters s ON s.id = r.semester_id
  JOIN organizations bc ON bc.id = r.org_id AND bc.level = '大班'
  WHERE r.org_id IS NOT NULL
    AND r.is_active = TRUE
    AND COALESCE(s.trial_start_date, s.start_date) IS NOT NULL
    AND s.end_date IS NOT NULL
),
target_orgs AS (
  SELECT
    rr.semester_id,
    rr.big_class_id,
    org.id AS org_id
  FROM rule_rows rr
  JOIN organizations org
    ON org.semester_id = rr.semester_id
   AND (
     org.id = rr.big_class_id
     OR org.parent_id = rr.big_class_id
     OR EXISTS (
       SELECT 1
       FROM organizations cls
       WHERE cls.id = org.parent_id
         AND cls.parent_id = rr.big_class_id
     )
   )
  GROUP BY rr.semester_id, rr.big_class_id, org.id
),
schedule_rows AS (
  SELECT
    rr.semester_id,
    d::DATE AS schedule_date,
    rr.scope_level,
    target_orgs.org_id,
    rr.title
  FROM rule_rows rr
  JOIN target_orgs
    ON target_orgs.semester_id = rr.semester_id
   AND target_orgs.big_class_id = rr.big_class_id
  CROSS JOIN LATERAL generate_series(rr.start_date, rr.end_date, INTERVAL '1 day') AS d
  WHERE EXTRACT(ISODOW FROM d)::INTEGER = rr.weekday
)
INSERT INTO study_schedule_instances (
  semester_id,
  schedule_date,
  scope_level,
  org_id,
  note
)
SELECT
  semester_id,
  schedule_date,
  scope_level,
  org_id,
  title
FROM schedule_rows
ON CONFLICT (semester_id, schedule_date, scope_level, org_id) DO NOTHING;
