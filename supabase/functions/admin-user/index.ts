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
const ACCOUNT_MANAGE_ACTIONS = new Set([
  'createProfileAccount',
  'grantModuleMembership',
  'disableModuleMembership'
]);
const MODULE_KEYS = new Set(['supervision', 'study', 'secretariat']);

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function jsonResponse(body, headers, status = 200) {
  return new Response(JSON.stringify(body), { headers, status });
}

async function getCurrentSemesterId() {
  const { data } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_current', 1)
    .maybeSingle();
  return data?.id || null;
}

async function hasCurrentSemesterModule(userId, semesterId, moduleKey) {
  if (!semesterId) return false;
  const { data, error } = await adminClient
    .from('module_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('semester_id', semesterId)
    .eq('module_key', moduleKey)
    .eq('enabled', true)
    .limit(1);
  return !error && !!(data && data.length);
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

  const currentSemesterId = await getCurrentSemesterId();
  const isAdmin = ADMIN_ROLES.has(profile.role);
  const hasSecretariat = await hasCurrentSemesterModule(user.id, currentSemesterId, 'secretariat');

  return {
    user,
    profile,
    currentSemesterId,
    isAdmin,
    canManageAccounts: isAdmin || hasSecretariat
  };
}

function validateModuleMembershipInput(params, caller) {
  const semesterId = Number(params.semesterId || params.semester_id || caller.currentSemesterId);
  const moduleKey = String(params.moduleKey || params.module_key || '').trim();
  const role = String(params.role || '').trim();
  const orgIdRaw = params.orgId ?? params.org_id ?? null;
  const orgId = orgIdRaw === null || orgIdRaw === '' || typeof orgIdRaw === 'undefined'
    ? null
    : Number(orgIdRaw);

  if (!semesterId || Number.isNaN(semesterId)) return { error: '缺少有效 semesterId' };
  if (!MODULE_KEYS.has(moduleKey)) return { error: '模块不合法' };
  if (!role) return { error: '缺少模块角色' };
  if (ADMIN_ROLES.has(role) && !caller.isAdmin) return { error: '只有管理员可以分配管理员权限' };
  if (orgId !== null && Number.isNaN(orgId)) return { error: '组织 ID 不合法' };

  return { semesterId, moduleKey, role, orgId };
}

async function upsertModuleMembership(userId, params, caller) {
  const parsed = validateModuleMembershipInput(params, caller);
  if (parsed.error) return { error: parsed.error };

  let existingQuery = adminClient
    .from('module_memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('semester_id', parsed.semesterId)
    .eq('module_key', parsed.moduleKey)
    .eq('role', parsed.role);

  existingQuery = parsed.orgId === null
    ? existingQuery.is('org_id', null)
    : existingQuery.eq('org_id', parsed.orgId);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) return { error: existingError.message };

  if (existing) {
    const { data, error } = await adminClient
      .from('module_memberships')
      .update({ enabled: true })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) return { error: error.message };
    const legacyError = await syncLegacySupervisionProfile(userId, parsed);
    if (legacyError) return { error: legacyError };
    return { membership: data };
  }

  const { data, error } = await adminClient
    .from('module_memberships')
    .insert({
      user_id: userId,
      semester_id: parsed.semesterId,
      module_key: parsed.moduleKey,
      role: parsed.role,
      org_id: parsed.orgId,
      enabled: true
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  const legacyError = await syncLegacySupervisionProfile(userId, parsed);
  if (legacyError) return { error: legacyError };
  return { membership: data };
}

async function syncLegacySupervisionProfile(userId, membership) {
  if (membership.moduleKey !== 'supervision') return null;
  const { error } = await adminClient
    .from('profiles')
    .update({
      role: membership.role,
      organization_id: membership.orgId
    })
    .eq('id', userId);
  return error ? error.message : null;
}

async function cleanupCreatedProfileAccount(userId) {
  if (!userId) return;
  await adminClient.from('profiles').delete().eq('id', userId);
  await adminClient.auth.admin.deleteUser(userId);
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

    if (ACCOUNT_MANAGE_ACTIONS.has(action) && !caller.canManageAccounts) {
      return jsonResponse({ error: '无秘书处账号管理权限' }, headers, 403);
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

      // 创建登录账号并写入 profiles，可选同步一条当前学期模块权限
      case 'createProfileAccount': {
        const accountName = String(name || '').trim();
        const accountPhone = normalizePhone(phone);
        const accountPassword = String(password || '');
        const accountEmail = String(email || (accountPhone ? `p${accountPhone}@supabase.io` : '')).trim();
        const profileRole = String(body.profileRole || '普通成员').trim() || '普通成员';
        const organizationId = body.organizationId ? Number(body.organizationId) : null;

        if (!accountName) return jsonResponse({ error: '缺少姓名' }, headers, 400);
        if (!accountPhone) return jsonResponse({ error: '缺少手机号' }, headers, 400);
        if (!accountEmail) return jsonResponse({ error: '缺少登录邮箱' }, headers, 400);
        if (accountPassword.length < 6) return jsonResponse({ error: '密码至少 6 位' }, headers, 400);
        if (ADMIN_ROLES.has(profileRole) && !caller.isAdmin) {
          return jsonResponse({ error: '只有管理员可以创建管理员账号' }, headers, 403);
        }
        if (organizationId !== null && Number.isNaN(organizationId)) {
          return jsonResponse({ error: '组织 ID 不合法' }, headers, 400);
        }

        const { data: existingProfile, error: existingError } = await adminClient
          .from('profiles')
          .select('id')
          .eq('phone', accountPhone)
          .maybeSingle();
        if (existingError) return jsonResponse({ error: existingError.message }, headers, 500);
        if (existingProfile) return jsonResponse({ error: '该手机号已关联登录账号' }, headers, 409);

        const { data, error } = await adminClient.auth.admin.createUser({
          email: accountEmail,
          password: accountPassword,
          email_confirm: true,
          user_metadata: {
            name: accountName,
            phone: accountPhone
          }
        });
        if (error || !data?.user?.id) {
          return jsonResponse({ error: error?.message || '创建登录账号失败' }, headers, 500);
        }

        const createdUserId = data.user.id;
        const { error: profileInsertError } = await adminClient.from('profiles').insert({
          id: createdUserId,
          name: accountName,
          phone: accountPhone,
          role: profileRole,
          organization_id: organizationId
        });
        if (profileInsertError) {
          await cleanupCreatedProfileAccount(createdUserId);
          return jsonResponse({ error: profileInsertError.message }, headers, 500);
        }

        let membership = null;
        if (body.moduleMembership) {
          const grantResult = await upsertModuleMembership(createdUserId, body.moduleMembership, caller);
          if (grantResult.error) {
            await cleanupCreatedProfileAccount(createdUserId);
            return jsonResponse({ error: grantResult.error }, headers, 400);
          }
          membership = grantResult.membership || null;
        }

        return jsonResponse({ success: true, userId: createdUserId, membership }, headers);
      }

      // 为已有登录账号添加/恢复模块权限
      case 'grantModuleMembership': {
        if (!userId) return jsonResponse({ error: '缺少 userId' }, headers, 400);
        const grantResult = await upsertModuleMembership(userId, body, caller);
        if (grantResult.error) return jsonResponse({ error: grantResult.error }, headers, 400);
        return jsonResponse({ success: true, membership: grantResult.membership }, headers);
      }

      // 停用模块权限
      case 'disableModuleMembership': {
        const membershipId = body.membershipId || body.id;
        if (!membershipId) return jsonResponse({ error: '缺少 membershipId' }, headers, 400);
        const { data: membership, error: membershipError } = await adminClient
          .from('module_memberships')
          .select('*')
          .eq('id', membershipId)
          .single();
        if (membershipError || !membership) {
          return jsonResponse({ error: membershipError?.message || '权限记录不存在' }, headers, 404);
        }
        if (ADMIN_ROLES.has(membership.role) && !caller.isAdmin) {
          return jsonResponse({ error: '只有管理员可以移除管理员权限' }, headers, 403);
        }
        const { error } = await adminClient
          .from('module_memberships')
          .update({ enabled: false })
          .eq('id', membershipId);
        if (error) return jsonResponse({ error: error.message }, headers, 500);
        return jsonResponse({ success: true }, headers);
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
