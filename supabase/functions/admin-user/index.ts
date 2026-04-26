// Supabase Edge Function: admin-user
// 部署命令: supabase functions deploy admin-user --project-ref whvjfurrkusdwujjodwc
// 服务端持有 service_role key，前端通过此 Edge Function 代理管理员操作

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://whvjfurrkusdwujjodwc.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    const { action, userId, email, name, password, delay } = await req.json();

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
        const { semester_id, start_date, end_date, trial_start_date } = req.body || {};
        if (!semester_id) return new Response(JSON.stringify({ error: '缺少 semester_id' }), { headers, status: 400 });

        const { data: templates } = await adminClient.from('assessment_types').select('id').eq('is_template', 1);
        const itemIds = templates?.map(t => t.id).join(',') || '';

        const toInsert = [];
        const start = new Date(start_date);
        const end = new Date(end_date);
        const trialStart = trial_start_date ? new Date(trial_start_date) : null;
        let current = trialStart ? new Date(trialStart) : new Date(start);

        while (current <= end) {
          toInsert.push({
            semester_id: semester_id,
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

        const { error } = await adminClient.from('schedules').upsert(toInsert, { onConflict: 'semester_id, schedule_date' });
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
