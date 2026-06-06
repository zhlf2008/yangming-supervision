-- ============================================================
-- 合并重复组织 + 添加唯一约束
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- ★ 第一步：查看当前有哪些重复组织
SELECT semester_id, parent_id, level, name, COUNT(*) as cnt
FROM organizations
GROUP BY semester_id, parent_id, level, name
HAVING COUNT(*) > 1;

-- ★ 第二步：根据上面查询结果，记下两个重复组的 ID
-- 查看「致格组」的具体信息（semester_id 和 parent_id 根据实际情况调整）
SELECT id, name, level, parent_id, semester_id
FROM organizations
WHERE name = '致格组' AND level = '小组'
ORDER BY id;

-- ★ 第三步：替换下面的 <保留的ID> 和 <要合并的ID>
-- 例如: SELECT merge_duplicate_orgs(10, 12);
--       第一个参数是保留的组ID，第二个参数是要合并删除的组ID

DO $$
DECLARE
    keep_id BIGINT := <保留的ID>;    -- 改成要保留的组的 ID
    merge_id BIGINT := <要合并的ID>; -- 改成要合并删除的组的 ID
    conflict_count INT;
BEGIN
    -- 检查两个 ID 都存在且不同
    IF keep_id = merge_id THEN
        RAISE EXCEPTION '两个 ID 不能相同';
    END IF;

    -- 1. 迁移 profiles
    UPDATE profiles SET organization_id = keep_id WHERE organization_id = merge_id;
    RAISE NOTICE '已迁移 % 个用户', (SELECT COUNT(*) FROM profiles WHERE organization_id = keep_id);

    -- 2. 处理 attendance_records 冲突（同一 schedule_id 已有记录则删除合并组的）
    DELETE FROM attendance_records
    WHERE organization_id = merge_id
      AND schedule_id IN (
        SELECT schedule_id FROM attendance_records WHERE organization_id = keep_id
      );
    RAISE NOTICE '已删除 % 条冲突考勤记录', (SELECT COUNT(*) FROM attendance_records WHERE organization_id = merge_id AND schedule_id IN (SELECT schedule_id FROM attendance_records WHERE organization_id = keep_id));

    -- 迁移无冲突的考勤记录
    UPDATE attendance_records SET organization_id = keep_id WHERE organization_id = merge_id;
    RAISE NOTICE '已迁移考勤记录';

    -- 3. 处理 reminder_configs（如果保留组已有配置则删除合并组的）
    IF EXISTS (SELECT 1 FROM reminder_configs WHERE org_id = keep_id) THEN
        DELETE FROM reminder_configs WHERE org_id = merge_id;
        RAISE NOTICE '保留组已有提醒配置，已删除合并组的配置';
    ELSE
        UPDATE reminder_configs SET org_id = keep_id WHERE org_id = merge_id;
        RAISE NOTICE '已迁移提醒配置';
    END IF;

    -- 4. 删除合并组
    DELETE FROM organizations WHERE id = merge_id;
    RAISE NOTICE '已删除合并组 (id=%)', merge_id;

    RAISE NOTICE '✅ 合并完成！';
END $$;

-- ★ 第四步：确认无重复后，创建唯一约束防止将来再出现
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_unique_name
ON organizations (semester_id, parent_id, level, name)
NULLS NOT DISTINCT;
