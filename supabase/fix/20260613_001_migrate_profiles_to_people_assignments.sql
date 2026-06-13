-- ============================================================
-- 旧账号归属迁移到秘书处人员模型
-- 将 profiles 同步到 people，并把 profiles.organization_id 写入当前学期 person_org_assignments
-- 可重复执行：不会重复创建同手机号人员，也不会重复创建同学期同组织归属
-- ============================================================

-- 1. 补齐 people：优先按手机号去重
INSERT INTO people (name, phone, status)
SELECT p.name, p.phone, 'active'
FROM profiles p
WHERE p.name IS NOT NULL
  AND p.phone IS NOT NULL
ON CONFLICT (phone) WHERE phone IS NOT NULL DO UPDATE
SET name = EXCLUDED.name;

-- 2. 补齐无手机号人员：按姓名兜底，避免重复插入
INSERT INTO people (name, phone, status)
SELECT p.name, NULL, 'active'
FROM profiles p
WHERE p.name IS NOT NULL
  AND p.phone IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM people pe
    WHERE pe.phone IS NULL
      AND pe.name = p.name
  );

-- 3. 如果同一人员在当前学期已有其他 active 归属，保留历史但标记为 transferred
WITH current_semester AS (
  SELECT id
  FROM semesters
  WHERE is_current = 1
  ORDER BY id DESC
  LIMIT 1
),
latest_profile_org AS (
  SELECT
    pe.id AS person_id,
    p.organization_id
  FROM profiles p
  JOIN people pe
    ON (
      (p.phone IS NOT NULL AND pe.phone = p.phone)
      OR (p.phone IS NULL AND pe.phone IS NULL AND pe.name = p.name)
    )
  WHERE p.organization_id IS NOT NULL
)
UPDATE person_org_assignments poa
SET status = 'transferred'
FROM current_semester cs, latest_profile_org lpo
WHERE poa.semester_id = cs.id
  AND poa.person_id = lpo.person_id
  AND poa.org_id <> lpo.organization_id
  AND poa.status = 'active';

-- 4. 将旧 profiles.organization_id 迁移为当前学期人员归属
WITH current_semester AS (
  SELECT id
  FROM semesters
  WHERE is_current = 1
  ORDER BY id DESC
  LIMIT 1
),
profile_people AS (
  SELECT
    p.id AS profile_id,
    p.name,
    p.phone,
    p.organization_id,
    pe.id AS person_id,
    o.level AS org_level
  FROM profiles p
  JOIN people pe
    ON (
      (p.phone IS NOT NULL AND pe.phone = p.phone)
      OR (p.phone IS NULL AND pe.phone IS NULL AND pe.name = p.name)
    )
  JOIN organizations o
    ON o.id = p.organization_id
  WHERE p.organization_id IS NOT NULL
)
INSERT INTO person_org_assignments (
  semester_id,
  person_id,
  org_id,
  org_level,
  status,
  sort_order
)
SELECT
  cs.id,
  pp.person_id,
  pp.organization_id,
  pp.org_level,
  'active',
  0
FROM current_semester cs
JOIN profile_people pp ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM person_org_assignments poa
  WHERE poa.semester_id = cs.id
    AND poa.person_id = pp.person_id
    AND poa.org_id = pp.organization_id
);
