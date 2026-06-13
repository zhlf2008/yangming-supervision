// Supabase Edge Function: admin-user
// 部署命令: supabase functions deploy admin-user --project-ref whvjfurrkusdwujjodwc
// 服务端持有 service_role key，前端通过此 Edge Function 代理管理员操作

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // 强制按 UTF-8 解码 body，避免 req.json() 在某些边缘场景下走 Latin-1
    const rawText = await req.text();
    const body = JSON.parse(new TextDecoder('utf-8').decode(new TextEncoder().encode(rawText)));
    const { action, userId, email, name, password, phone } = body;

    switch (action) {

      // 删除用户（从 auth.users 中删除）
      case 'deleteUser': {
        if (!userId) return new Response(JSON.stringify({ error: '缺少 userId' }), { headers, status: 400 });
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 创建用户（管理员用 service_role 创建，不受前端 IP 限流）
      case 'createUser': {
        if (!email || !password) return new Response(JSON.stringify({ error: '缺少 email 或 password' }), { headers, status: 400 });
        const createParams = {
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {}
        };
        if (name) createParams.user_metadata.name = name;
        if (phone) createParams.user_metadata.phone = phone;
        const { data, error } = await adminClient.auth.admin.createUser(createParams);
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true, userId: data.user.id }), { headers });
      }

      // 更新用户（邮箱、姓名、密码）
      case 'updateUser': {
        if (!userId) return new Response(JSON.stringify({ error: '缺少 userId' }), { headers, status: 400 });
        const updateParams = {};
        if (email) updateParams.email = email;
        if (password) updateParams.password = password;
        if (name || phone) {
          updateParams.user_metadata = {};
          if (name) updateParams.user_metadata.name = name;
          if (phone) updateParams.user_metadata.phone = phone;
        }
        const { error } = await adminClient.auth.admin.updateUserById(userId, updateParams);
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 批量生成日程（服务端执行避免前端卡死）
      case 'generateSchedules': {
        const { semester_id, start_date, end_date, trial_start_date, org_id } = body;
        if (!semester_id) return new Response(JSON.stringify({ error: '缺少 semester_id' }), { headers, status: 400 });
        if (!org_id) return new Response(JSON.stringify({ error: '缺少 org_id' }), { headers, status: 400 });

        const { data: templates } = await adminClient.from('assessment_types').select('id').eq('is_template', 1).eq('semester_id', semester_id);
        const itemIds = templates?.map(t => t.id).join(',') || '';

        const toInsert = [];
        const start = new Date(start_date);
        const end = new Date(end_date);
        const trialStart = trial_start_date ? new Date(trial_start_date) : null;
        let current = trialStart ? new Date(trialStart) : new Date(start);

        while (current <= end) {
          toInsert.push({
            semester_id: semester_id,
            org_id: org_id,
            schedule_date: current.toISOString().split('T')[0],
            week_day: current.getDay() + 1,
            item_ids: itemIds,
            is_valid: 1
          });
          current.setDate(current.getDate() + 1);
          if (trialStart && current.getTime() >= start.getTime()) {
            current = new Date(start);
            trialStart = null; // 防止循环
          }
        }

        const { error } = await adminClient.from('schedules').upsert(toInsert, { onConflict: 'semester_id, org_id, schedule_date' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true, count: toInsert.length }), { headers });
      }

      // 同步 module_memberships（从 profiles 迁移）
      case 'syncModuleMemberships': {
        const { data: profiles, error: pfErr } = await adminClient.from('profiles').select('id, role, organization_id');
        if (pfErr) return new Response(JSON.stringify({ error: pfErr.message }), { headers, status: 500 });
        let count = 0;
        for (const p of profiles || []) {
          if (!p.role) continue;
          const { error } = await adminClient.from('module_memberships').upsert({
            user_id: p.id, module_key: 'supervision', role: p.role, org_id: p.organization_id, enabled: true
          }, { onConflict: 'user_id, module_key, role, COALESCE(org_id, 0)' });
          if (!error) count++;
        }
        return new Response(JSON.stringify({ success: true, synced: count }), { headers });
      }

      // 同步人员档案（profiles → people）
      case 'syncPeople': {
        const { data: profiles, error: pfErr } = await adminClient.from('profiles').select('name, phone');
        if (pfErr) return new Response(JSON.stringify({ error: pfErr.message }), { headers, status: 500 });
        let ok = 0, skip = 0, errs = [];
        // 先确认一次 RLS 是否能 SELECT people
        const { data: probe, error: probeErr } = await adminClient.from('people').select('id').limit(1);
        for (const p of profiles || []) {
          if (!p.name) continue;
          if (p.phone) {
            const { data: exist } = await adminClient.from('people').select('id').eq('phone', p.phone).limit(1);
            if (exist && exist.length > 0) { skip++; continue; }
            const { data: ins, error } = await adminClient.from('people').insert({ name: p.name, phone: p.phone, status: 'active' }).select('id');
            if (error) { skip++; errs.push(`${p.name}: ${error.message}`); } else { ok++; }
          } else {
            const { data: exist } = await adminClient.from('people').select('id').eq('name', p.name).is('phone', null).limit(1);
            if (exist && exist.length > 0) { skip++; continue; }
            const { data: ins, error } = await adminClient.from('people').insert({ name: p.name, phone: null, status: 'active' }).select('id');
            if (error) { skip++; errs.push(`${p.name}: ${error.message}`); } else { ok++; }
          }
        }
        // 再次查 people 总数确认
        const { count } = await adminClient.from('people').select('id', { count: 'exact', head: true });
        return new Response(JSON.stringify({ success: true, synced: ok, skipped: skip, total: count, probeErr: probeErr?.message, errors: errs.slice(0, 5) }), { headers });
      }

      // 设置人员职务
      case 'setPersonPosition': {
        // 支持 person_id 或 person_name 两种入参
        let { person_id, person_name, semester_id, org_id, position_name, position_scope } = body;
        if (!person_id && person_name) {
          const { data: ppl } = await adminClient.from('people').select('id').eq('name', person_name).limit(1);
          person_id = ppl?.[0]?.id;
        }
        if (!person_id || !semester_id || !position_name || !position_scope) {
          return new Response(JSON.stringify({ error: '缺少必填字段', have: { person_id, semester_id, position_name, position_scope } }), { headers, status: 400 });
        }
        const { error } = await adminClient.from('person_positions').upsert({
          semester_id, person_id, org_id: org_id || null, position_name, position_scope, is_active: true
        }, { onConflict: 'semester_id, person_id, position_name, COALESCE(org_id, 0)' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true, person_id }), { headers });
      }

      // 设置人员组织归属
      case 'setPersonOrg': {
        let { person_id, person_name, semester_id, org_id, org_level } = body;
        if (!person_id && person_name) {
          const { data: ppl } = await adminClient.from('people').select('id').eq('name', person_name).limit(1);
          person_id = ppl?.[0]?.id;
        }
        if (!person_id || !semester_id || !org_id || !org_level) {
          return new Response(JSON.stringify({ error: '缺少必填字段' }), { headers, status: 400 });
        }
        const { error } = await adminClient.from('person_org_assignments').upsert({
          semester_id, person_id, org_id, org_level, status: 'active'
        }, { onConflict: 'semester_id, person_id, org_id' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true, person_id }), { headers });
      }

      // 通用 upsert（按 person_id 直接写）
      case 'upsertByPersonId': {
        const { table, rows, onConflict, keyCols } = body;
        if (!table || !rows) return new Response(JSON.stringify({ error: '缺少 table/rows' }), { headers, status: 400 });
        const arr = Array.isArray(rows) ? rows : [rows];
        let ok = 0, errors = [];
        for (const r of arr) {
          if (Array.isArray(keyCols) && keyCols.length > 0) {
            let q = adminClient.from(table).select('id');
            keyCols.forEach((k) => { q = q.eq(k, r[k]); });
            const { data: exist } = await q.limit(1);
            if (exist && exist.length > 0) { ok++; continue; }
          }
          const { error } = await adminClient.from(table).insert(r);
          if (error) { errors.push(`${JSON.stringify(r)}: ${error.message}`); } else { ok++; }
        }
        if (errors.length > 0) return new Response(JSON.stringify({ success: false, ok, errors: errors.slice(0, 3) }), { headers, status: 500 });
        return new Response(JSON.stringify({ success: true, count: ok }), { headers });
      }

      // 探查：返回 module_memberships 的实际列
      case 'probeModuleMemberships': {
        // 用 limit 0 + select('*') 拿不到列。改用 information_schema（需 service_role）
        const { data, error } = await adminClient.rpc('exec_sql', { sql: "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'module_memberships' ORDER BY ordinal_position" });
        return new Response(JSON.stringify({ data, error: error?.message }), { headers });
      }

      default:
        return new Response(JSON.stringify({ error: '未知操作: ' + action }), { headers, status: 400 });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
