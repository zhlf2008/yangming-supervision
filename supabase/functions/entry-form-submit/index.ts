import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase server configuration');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const genders = new Set(['男', '女']);
const studentTypes = new Set(['new', 'midway', 'completed']);
const acknowledgements = new Set(['已知晓', '不清晰需咨询']);
const roles = new Set([
  '班长',
  '执行班长',
  '秘书长',
  '班委学委',
  '班委宣委',
  '班委督察',
  '班委组织委',
  '班委生活委',
  '组委学委',
  '组委宣委',
  '组委督察',
  '组委组织委',
  '组委生活委',
  '用心做好学员'
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function cleanText(value: unknown, maxLength: number) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : '';
}

function validDate(value: unknown) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 20_000) return json({ error: '请求内容过大' }, 413);

  try {
    const body = await req.json();

    if (cleanText(body.website, 200)) return json({ error: '提交失败' }, 400);

    const startedAt = new Date(String(body.started_at || '')).getTime();
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(startedAt) || elapsed < 2_000 || elapsed > 86_400_000) {
      return json({ error: '页面已失效，请刷新后重试' }, 400);
    }

    const name = cleanText(body.name, 40);
    const phone = String(body.phone || '').replace(/\D/g, '');
    const gender = cleanText(body.gender, 4);
    const birthdayDate = cleanText(body.birthday_date, 10);
    const province = cleanText(body.province, 30);
    const city = cleanText(body.city_old, 30);
    const district = cleanText(body.district, 30);
    const occupation = cleanText(body.occupation_category, 60);
    const position = cleanText(body.position_type, 40);
    const studentType = cleanText(body.student_type, 20);
    const desiredGains = cleanText(body.desired_gains, 500);
    const desiredRole = cleanText(body.desired_role, 40);
    const acknowledgement = cleanText(body.schedule_acknowledged, 20);
    const signature = cleanText(body.commitment_signature, 40);
    const hobbies = Array.isArray(body.hobbies_interests)
      ? body.hobbies_interests
          .map((item: unknown) => cleanText(item, 30))
          .filter(Boolean)
          .slice(0, 20)
      : [];

    if (
      !name ||
      !/^1[3-9]\d{9}$/.test(phone) ||
      !genders.has(gender) ||
      !validDate(birthdayDate) ||
      !province ||
      !city ||
      !occupation ||
      !position ||
      !studentTypes.has(studentType) ||
      !acknowledgements.has(acknowledgement) ||
      !signature ||
      (desiredRole && !roles.has(desiredRole))
    ) {
      return json({ error: '表单内容不完整或格式不正确' }, 400);
    }

    const { data: semester, error: semesterError } = await adminClient
      .from('semesters')
      .select('id')
      .eq('is_current', 1)
      .maybeSingle();

    if (semesterError || !semester) return json({ error: '当前没有可提交的学期' }, 409);

    const orgId = Number(body.org_id || 0);
    if (orgId) {
      const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .eq('semester_id', semester.id)
        .eq('level', '班级')
        .eq('is_active', true)
        .maybeSingle();
      if (orgError || !org) return json({ error: '进班链接无效或已过期' }, 400);
    }

    const { data: existing, error: existingError } = await adminClient
      .from('entry_forms')
      .select('id')
      .eq('semester_id', semester.id)
      .eq('phone', phone)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return json({ error: '本学期已提交过申请，请勿重复提交' }, 409);

    const { error: insertError } = await adminClient.from('entry_forms').insert({
      semester_id: semester.id,
      person_id: null,
      name,
      phone,
      gender,
      birthday_date: birthdayDate,
      birthday_type: 'solar',
      province,
      city_old: city,
      district: district || null,
      occupation_category: occupation,
      position_type: position,
      hobbies_interests: hobbies,
      student_type: studentType,
      desired_gains: desiredGains || null,
      desired_role: desiredRole || null,
      schedule_acknowledged: acknowledgement,
      commitment_signature: signature,
      status: 'active'
    });

    if (insertError) throw insertError;
    return json({ success: true }, 201);
  } catch (error) {
    console.error('entry-form-submit failed', error);
    return json({ error: '提交服务暂不可用，请稍后重试' }, 500);
  }
});
