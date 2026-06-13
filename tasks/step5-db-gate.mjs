// Step 5 数据库发布闸门 — 只读核对
// 验证当前学期唯一、人员数据齐全、迁移覆盖
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const report = {};

async function run() {
  // 1. 学期列表
  const { data: semesters } = await client
    .from('semesters')
    .select('id, semester_name, is_current, effective_at, start_date, end_date')
    .order('id');
  report.semesters = semesters || [];
  report.current_count = (semesters || []).filter((s) => s.is_current === 1 || s.is_current === true).length;

  // 2. people 总数
  const { count: peopleCount } = await client
    .from('people')
    .select('id', { count: 'exact', head: true });
  report.people_count = peopleCount || 0;

  // 3. person_org_assignments active 数
  const { count: poaActive } = await client
    .from('person_org_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  report.person_org_assignments_active = poaActive || 0;

  // 4. module_memberships 启用数
  const { count: mmEnabled } = await client
    .from('module_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('enabled', true);
  report.module_memberships_enabled = mmEnabled || 0;

  // 5. module_memberships 当前学期数
  const currentSem = (semesters || []).find((s) => s.is_current === 1 || s.is_current === true);
  if (currentSem) {
    const { count: mmCurrent } = await client
      .from('module_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('semester_id', currentSem.id);
    report.module_memberships_current_semester = mmCurrent || 0;
  }

  // 6. 孤儿日程（无 semester_id）
  const { count: orphanSchedules } = await client
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .is('semester_id', null);
  report.schedules_no_semester = orphanSchedules || 0;

  // 7. 孤儿考勤（对应 schedule 缺失）
  const { data: attendanceRows } = await client.from('attendance_records').select('id, schedule_id');
  const scheduleIds = [...new Set((attendanceRows || []).map((r) => r.schedule_id).filter(Boolean))];
  let existingScheduleIds = new Set();
  for (let i = 0; i < scheduleIds.length; i += 1000) {
    const chunk = scheduleIds.slice(i, i + 1000);
    const { data: existingRows } = await client.from('schedules').select('id').in('id', chunk);
    existingRows.forEach((r) => existingScheduleIds.add(r.id));
  }
  const orphanAttendance = (attendanceRows || []).filter((r) => r.schedule_id && !existingScheduleIds.has(r.schedule_id));
  report.orphan_attendance_count = orphanAttendance.length;
  report.orphan_attendance_sample = orphanAttendance.slice(0, 5);

  // 8. entry_forms 记录数
  const { count: efCount } = await client
    .from('entry_forms')
    .select('id', { count: 'exact', head: true });
  report.entry_forms_count = efCount || 0;

  // 9. audit_logs 总量 + 最近 module_key 分布
  const { count: alCount } = await client
    .from('audit_logs')
    .select('id', { count: 'exact', head: true });
  report.audit_logs_count = alCount || 0;

  // 10. 当前学期 module_memberships 按 module_key 分组(roadmap Cycle 1 复核)
  if (currentSem) {
    const { data: mmByKey } = await client
      .from('module_memberships')
      .select('module_key')
      .eq('semester_id', currentSem.id)
      .eq('enabled', true);
    const buckets = {};
    (mmByKey || []).forEach((r) => {
      buckets[r.module_key] = (buckets[r.module_key] || 0) + 1;
    });
    report.module_memberships_by_key = buckets;
  }

  // 11. temp_regression_* 残留检测(roadmap 期望 temp_left = 0)
  const { count: tempLeft } = await client
    .from('module_memberships')
    .select('id', { count: 'exact', head: true })
    .in('role', ['temp_regression_secretariat', 'temp_regression_study']);
  report.temp_regression_left = tempLeft || 0;

  // 12. schedules 无学期(roadmap 期望 0) — 已在 item 6 统计,此处留 alias
  report.schedules_no_semester_again = report.schedules_no_semester;

  // 13. 孤儿考勤(roadmap 期望 0) — 已在 item 7 统计
  report.orphan_attendance_again = report.orphan_attendance_count;
}

run()
  .then(() => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(2);
  });
