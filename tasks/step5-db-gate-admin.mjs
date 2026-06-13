// Step 5 数据库发布闸门（管理员 JWT 视角）
// 与 tasks/step5-db-gate.mjs 对照：原版用 anon key 受 RLS 影响，
// 看不到 module_memberships / people / person_org_assignments。
// 本脚本用管理员 JWT 重新核对，与 cycle1-verification-comment.md 的 2026-06-14 修正口径一致。
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const ADMIN_EMAIL = 'p15888396623@supabase.io';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '19871125';

async function main() {
  // 1. 登录拿 JWT
  const anon = createClient(SUPABASE_URL, 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_', {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: auth, error: authErr } = await anon.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD
  });
  if (authErr || !auth?.session) {
    console.error('LOGIN FAILED:', authErr?.message || 'no session');
    process.exit(2);
  }
  const token = auth.session.access_token;
  const admin = createClient(SUPABASE_URL, 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const report = {};

  // 2. 学期列表 + 当前学期
  const { data: semesters } = await admin.from('semesters')
    .select('id, semester_name, is_current, effective_at')
    .order('id');
  report.semesters = semesters || [];
  report.current_count = (semesters || []).filter(s => s.is_current === 1 || s.is_current === true).length;
  const currentSem = (semesters || []).find(s => s.is_current === 1 || s.is_current === true);

  // 3. profiles 总数 + 当前学期有 organization_id
  const { count: profileCount } = await admin.from('profiles')
    .select('id', { count: 'exact', head: true });
  const { count: profileOrg } = await admin.from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('organization_id', 'is', null);
  report.profiles_total = profileCount || 0;
  report.profiles_with_org = profileOrg || 0;

  // 4. people 总数
  const { count: peopleCount } = await admin.from('people')
    .select('id', { count: 'exact', head: true });
  report.people_count = peopleCount || 0;

  // 5. person_org_assignments active
  const { count: poaActive } = await admin.from('person_org_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  report.person_org_assignments_active = poaActive || 0;

  // 6. module_memberships 总启 + 当前学期启 + 当前学期按 module_key 分组
  const { count: mmEnabled } = await admin.from('module_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('enabled', true);
  report.module_memberships_enabled = mmEnabled || 0;
  if (currentSem) {
    const { count: mmCurrent } = await admin.from('module_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('semester_id', currentSem.id).eq('enabled', true);
    report.module_memberships_current_semester = mmCurrent || 0;

    const { data: mmByKey } = await admin.from('module_memberships')
      .select('module_key, role')
      .eq('semester_id', currentSem.id).eq('enabled', true);
    const buckets = {};
    const roles = {};
    (mmByKey || []).forEach(r => {
      buckets[r.module_key] = (buckets[r.module_key] || 0) + 1;
      const tag = `${r.module_key}/${r.role}`;
      roles[tag] = (roles[tag] || 0) + 1;
    });
    report.current_semester_by_module_key = buckets;
    report.current_semester_by_module_role = roles;
  }

  // 7. 临时权限残留
  const { count: tempLeft } = await admin.from('module_memberships')
    .select('id', { count: 'exact', head: true })
    .in('role', ['temp_regression_secretariat', 'temp_regression_study', 'regression_long_term']);
  report.temp_or_long_term_left = tempLeft || 0;

  // 8. 孤儿日程 / 孤儿考勤
  const { count: orphanSchedules } = await admin.from('schedules')
    .select('id', { count: 'exact', head: true })
    .is('semester_id', null);
  report.schedules_no_semester = orphanSchedules || 0;

  const { data: attRows } = await admin.from('attendance_records').select('id, schedule_id');
  const sIds = [...new Set((attRows || []).map(r => r.schedule_id).filter(Boolean))];
  const exist = new Set();
  for (let i = 0; i < sIds.length; i += 1000) {
    const chunk = sIds.slice(i, i + 1000);
    const { data } = await admin.from('schedules').select('id').in('id', chunk);
    (data || []).forEach(r => exist.add(r.id));
  }
  const orphanAtt = (attRows || []).filter(r => r.schedule_id && !exist.has(r.schedule_id));
  report.orphan_attendance_count = orphanAtt.length;

  // 9. entry_forms
  const { count: efCount } = await admin.from('entry_forms')
    .select('id', { count: 'exact', head: true });
  report.entry_forms_count = efCount || 0;

  // 10. audit_logs
  const { count: alCount } = await admin.from('audit_logs')
    .select('id', { count: 'exact', head: true });
  report.audit_logs_count = alCount || 0;

  // 11. 4 类测试账号权限矩阵
  const testIds = [
    'a54c6422-515e-4e51-abd7-52e8bea94fa3', // 管理员
    'b721bec6-70f6-4e3a-9abf-0c38cf0f741c', // 秘书处
    '53aaa656-9087-44c4-b255-84676ef7139b', // 学委
    '8b5fadd3-aabc-4d9b-9648-52b1b141b3a2'  // 无权限
  ];
  const { data: testMms } = await admin.from('module_memberships')
    .select('user_id, module_key, role, semester_id, enabled')
    .in('user_id', testIds);
  report.test_account_memberships = testMms || [];

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
