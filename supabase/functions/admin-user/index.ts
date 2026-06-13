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

const ADMIN_ROLES = new Set(['超级管理员', '管理员']);

function jsonResponse(body, headers, status = 200) {
  return new Response(JSON.stringify(body), { headers, status });
}

async function getCaller(req) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: '未登录', status: 401 };

  const { data: userResult, error: userError } = await adminClient.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return { error: '登录状态无效', status: 401 };

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return { error: '账号档案不存在', status: 403 };

  return {
    user,
    profile,
    isAdmin: ADMIN_ROLES.has(profile.role)
  };
}

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
    const body = await req.json();
    const { action, userId, email, name, password, phone } = body;
    const caller = await getCaller(req);

    if (caller.error) {
      return jsonResponse({ error: caller.error }, headers, caller.status);
    }

    if (['createUser', 'deleteUser', 'generateSchedules'].includes(action) && !caller.isAdmin) {
      return jsonResponse({ error: '无管理员权限' }, headers, 403);
    }

    if (action === 'updateUser' && !caller.isAdmin && userId !== caller.user.id) {
      return jsonResponse({ error: '只能更新自己的登录信息' }, headers, 403);
    }

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
        let trialStart = trial_start_date ? new Date(trial_start_date) : null;
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

      default:
        return new Response(JSON.stringify({ error: '未知操作: ' + action }), { headers, status: 400 });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
