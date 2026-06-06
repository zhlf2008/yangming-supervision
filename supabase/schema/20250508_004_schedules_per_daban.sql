-- 日程按大班隔离：schedules 表新增 org_id，唯一约束改为 (semester_id, org_id, schedule_date)
-- 现有日程复制到每个大班，考勤记录重新映射 schedule_id

-- 1. 添加 org_id 列（先可空）
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS org_id BIGINT;

-- 2. 移除旧的唯一约束（实际约束名为 schedules_semester_id_schedule_date_key）
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_semester_id_schedule_date_key;
DROP INDEX IF EXISTS schedules_semester_id_schedule_date_key;

-- 3. 为每个学期的大班复制日程，并重映射考勤记录
DO $$
DECLARE
  sem RECORD;
  first_daban_id BIGINT;
  daban RECORD;
  sched RECORD;
  new_sid BIGINT;
BEGIN
  FOR sem IN SELECT id FROM semesters ORDER BY id LOOP
    -- 找到该学期第一个大班
    SELECT id INTO first_daban_id
      FROM organizations
      WHERE level = '大班' AND semester_id = sem.id
      ORDER BY id LIMIT 1;

    IF first_daban_id IS NULL THEN
      -- 没有大班，跳过
      CONTINUE;
    END IF;

    -- 将现有日程归属第一个大班
    UPDATE schedules SET org_id = first_daban_id
      WHERE semester_id = sem.id AND org_id IS NULL;

    -- 为该学期其余大班复制日程
    FOR daban IN
      SELECT id FROM organizations
        WHERE level = '大班' AND semester_id = sem.id AND id != first_daban_id
        ORDER BY id
    LOOP
      FOR sched IN
        SELECT * FROM schedules
          WHERE semester_id = sem.id AND org_id = first_daban_id
      LOOP
        INSERT INTO schedules (semester_id, schedule_date, week_day, item_ids, is_valid, org_id)
        VALUES (sched.semester_id, sched.schedule_date, sched.week_day, sched.item_ids, sched.is_valid, daban.id)
        RETURNING id INTO new_sid;

        -- 重映射考勤记录：该大班下属小组的记录指向新日程
        UPDATE attendance_records ar
        SET schedule_id = new_sid
        FROM organizations og, organizations oc
        WHERE ar.schedule_id = sched.id
          AND ar.organization_id = og.id
          AND og.parent_id = oc.id
          AND oc.parent_id = daban.id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 4. 设 NOT NULL
ALTER TABLE schedules ALTER COLUMN org_id SET NOT NULL;

-- 5. 创建新的唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique
  ON schedules (semester_id, org_id, schedule_date);
