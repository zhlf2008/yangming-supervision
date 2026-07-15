import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DISPATCHER_SECRET_SHA256 =
  Deno.env.get('ORGANIZATION_NOTIFICATION_SECRET_SHA256') ||
  'd360e8eee3f98a474bc9934335939b6d78f769c9ab0b2dd3c064c8b9e4149082';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('缺少 Supabase 服务端环境变量');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

type ClaimedNotification = {
  id: number;
  org_id: number;
  title: string;
  content: string;
  webhook_url: string;
  attempt_count: number;
};

type Organization = {
  id: number;
  name: string;
  level: string;
  parent_id: number | null;
};

type ReminderConfig = {
  id: number;
  org_id: number;
  start_time: string | null;
  end_time: string | null;
  interval_minutes: number | null;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isAuthorized(req: Request): Promise<boolean> {
  const secret = (req.headers.get('x-dispatcher-secret') || '').trim();
  if (!secret || !DISPATCHER_SECRET_SHA256) return false;
  return (await sha256(secret)) === DISPATCHER_SECRET_SHA256;
}

function isAllowedWebhook(webhookUrl: string): boolean {
  try {
    const url = new URL(webhookUrl);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'qyapi.weixin.qq.com' &&
      url.pathname === '/cgi-bin/webhook/send' &&
      !!url.searchParams.get('key')
    );
  } catch {
    return false;
  }
}

function buildMarkdown(notification: ClaimedNotification): string {
  const title = String(notification.title || '').trim();
  const content = String(notification.content || '').trim();
  const markdown = title ? `## ${title}\n\n${content}` : content;
  return markdown.length > 4000 ? `${markdown.slice(0, 3970)}\n\n内容过长，已截断。` : markdown;
}

function getBeijingNow() {
  const utcNow = new Date();
  const beijing = new Date(utcNow.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  const hour = String(beijing.getUTCHours()).padStart(2, '0');
  const minute = String(beijing.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    dayOfWeek: beijing.getUTCDay(),
    minuteOfDay: beijing.getUTCHours() * 60 + beijing.getUTCMinutes()
  };
}

function timeToMinutes(value: string): number {
  const parts = String(value || '00:00')
    .split(':')
    .map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

async function produceClassFillReminders() {
  const now = getBeijingNow();
  const { data: semesters, error: semesterError } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_current', 1)
    .limit(1);
  if (semesterError) throw semesterError;
  if (!semesters?.length) return { eligible: 0, created: 0, duplicates: 0 };
  const semesterId = Number(semesters[0].id);

  const [organizationResult, webhookResult, reminderResult, assessmentResult] = await Promise.all([
    adminClient
      .from('organizations')
      .select('id,name,level,parent_id')
      .eq('semester_id', semesterId)
      .eq('is_active', true),
    adminClient.from('organization_webhook_configs').select('org_id').eq('semester_id', semesterId).eq('enabled', true),
    adminClient.from('reminder_configs').select('id,org_id,start_time,end_time,interval_minutes').eq('enabled', true),
    adminClient.from('assessment_types').select('id,fields').eq('semester_id', semesterId)
  ]);

  if (organizationResult.error) throw organizationResult.error;
  if (webhookResult.error) throw webhookResult.error;
  if (reminderResult.error) throw reminderResult.error;
  if (assessmentResult.error) throw assessmentResult.error;

  const organizations = (organizationResult.data || []) as Organization[];
  const enabledClassIds = new Set((webhookResult.data || []).map((config) => Number(config.org_id)));
  const reminderConfigMap = new Map(
    ((reminderResult.data || []) as ReminderConfig[]).map((config) => [Number(config.org_id), config])
  );
  const eligibleClasses = organizations.filter((organization) => {
    if (organization.level !== '班级' || !enabledClassIds.has(Number(organization.id))) return false;
    return organization.parent_id && reminderConfigMap.has(Number(organization.parent_id));
  });
  if (!eligibleClasses.length) return { eligible: 0, created: 0, duplicates: 0 };

  const bigClassIds = Array.from(
    new Set(eligibleClasses.map((organization) => Number(organization.parent_id)).filter(Boolean))
  );
  const { data: schedules, error: scheduleError } = await adminClient
    .from('schedules')
    .select('id,org_id,item_ids')
    .eq('schedule_date', now.date)
    .eq('is_valid', 1)
    .in('org_id', bigClassIds);
  if (scheduleError) throw scheduleError;
  if (!schedules?.length) return { eligible: eligibleClasses.length, created: 0, duplicates: 0 };

  const { data: deadlineConfigs, error: deadlineError } = await adminClient
    .from('assessment_deadline_configs')
    .select('org_id,assessment_type_id,days_of_week,cutoff_time')
    .eq('is_enabled', true)
    .in('org_id', bigClassIds);
  if (deadlineError) throw deadlineError;

  const scheduleIds = schedules.map((schedule) => Number(schedule.id));
  const groupIds = organizations
    .filter(
      (organization) =>
        organization.level === '小组' &&
        eligibleClasses.some((classOrganization) => Number(classOrganization.id) === Number(organization.parent_id))
    )
    .map((organization) => Number(organization.id));
  if (!groupIds.length) return { eligible: eligibleClasses.length, created: 0, duplicates: 0 };

  const { data: records, error: recordError } = await adminClient
    .from('attendance_records')
    .select('organization_id,schedule_id,fill_data')
    .in('schedule_id', scheduleIds)
    .in('organization_id', groupIds);
  if (recordError) throw recordError;

  const assessmentFields = new Map(
    (assessmentResult.data || []).map((assessment) => [Number(assessment.id), assessment.fields || {}])
  );
  let created = 0;
  let duplicates = 0;

  for (const classOrganization of eligibleClasses) {
    const bigClassId = Number(classOrganization.parent_id);
    const config = reminderConfigMap.get(bigClassId)!;
    const startTime = config.start_time || '12:00';
    const endTime = config.end_time || '20:00';
    const startMinute = timeToMinutes(startTime);
    const endMinute = timeToMinutes(endTime);
    if (now.minuteOfDay < startMinute || now.minuteOfDay >= endMinute) continue;

    const intervalMinutes = Math.max(Number(config.interval_minutes) || 60, 15);
    const intervalBucket = Math.floor((now.minuteOfDay - startMinute) / intervalMinutes);
    const classSchedules = schedules.filter((schedule) => Number(schedule.org_id) === bigClassId);
    const classScheduleIds = new Set(classSchedules.map((schedule) => Number(schedule.id)));
    if (!classScheduleIds.size) continue;

    const bigClassDeadlines = (deadlineConfigs || []).filter((deadline) => Number(deadline.org_id) === bigClassId);
    const allItemsLocked =
      bigClassDeadlines.length > 0 &&
      classSchedules.every((schedule) => {
        const itemIds = String(schedule.item_ids || '')
          .split(',')
          .map(Number)
          .filter(Boolean);
        return (
          itemIds.length > 0 &&
          itemIds.every((itemId) => {
            const deadline = bigClassDeadlines.find((rule) => Number(rule.assessment_type_id) === itemId);
            if (!deadline) return false;
            const days = String(deadline.days_of_week || '')
              .split(',')
              .map(Number);
            return days.includes(now.dayOfWeek) && now.time >= String(deadline.cutoff_time || '23:59');
          })
        );
      });
    if (allItemsLocked) continue;

    const requiredFields = new Set<string>();
    for (const schedule of classSchedules) {
      const itemIds = String(schedule.item_ids || '')
        .split(',')
        .map(Number)
        .filter(Boolean);
      for (const itemId of itemIds) {
        const fields = assessmentFields.get(itemId) as Record<string, unknown> | undefined;
        for (const [fieldName, metadata] of Object.entries(fields || {})) {
          if (String(metadata).includes('必填')) requiredFields.add(fieldName);
        }
      }
    }

    const groups = organizations.filter(
      (organization) => organization.level === '小组' && Number(organization.parent_id) === Number(classOrganization.id)
    );
    const submittedGroupIds = new Set<number>();
    for (const record of records || []) {
      if (!classScheduleIds.has(Number(record.schedule_id))) continue;
      const fillData = (record.fill_data || {}) as Record<string, unknown>;
      const complete =
        requiredFields.size === 0 ||
        Array.from(requiredFields).every((fieldName) => {
          const value = fillData[fieldName];
          return value !== null && value !== undefined && value !== '';
        });
      if (complete) submittedGroupIds.add(Number(record.organization_id));
    }

    const unsubmittedGroups = groups.filter((group) => !submittedGroupIds.has(Number(group.id)));
    if (!unsubmittedGroups.length) continue;
    const submittedCount = groups.length - unsubmittedGroups.length;
    const content = [
      `**${classOrganization.name}** 截至 ${now.time}，已填报 **${submittedCount} / ${groups.length}** 个小组。`,
      '',
      `尚未填报：${unsubmittedGroups.map((group) => group.name).join('、')}`,
      '',
      `共 **${unsubmittedGroups.length}** 个小组未填报，请尽快完成。`
    ].join('\n');
    const dedupeKey = ['class-fill-reminder', now.date, startTime, intervalMinutes, intervalBucket].join(':');
    const { error: insertError } = await adminClient.from('organization_notification_outbox').insert({
      semester_id: semesterId,
      org_id: Number(classOrganization.id),
      module_key: 'supervision',
      event_key: 'fill_reminder',
      title: '填报提醒',
      content,
      dedupe_key: dedupeKey
    });
    if (!insertError) {
      created++;
    } else if (insertError.code === '23505') {
      duplicates++;
    } else {
      throw insertError;
    }
  }

  return { eligible: eligibleClasses.length, created, duplicates };
}

async function completeNotification(
  id: number,
  succeeded: boolean,
  responsePayload: Record<string, unknown> | null,
  errorMessage: string | null
) {
  const { error } = await adminClient.rpc('complete_organization_notification', {
    notification_id: id,
    succeeded,
    response_payload: responsePayload,
    error_message: errorMessage
  });
  if (error) throw error;
}

async function dispatchNotification(notification: ClaimedNotification) {
  if (!isAllowedWebhook(notification.webhook_url)) {
    await completeNotification(notification.id, false, null, 'Webhook 地址不合法');
    return { id: notification.id, success: false, error: 'Webhook 地址不合法' };
  }

  try {
    const response = await fetch(notification.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: buildMarkdown(notification) }
      }),
      signal: AbortSignal.timeout(12000)
    });
    const responseText = await response.text();
    let responsePayload: Record<string, unknown> = { raw: responseText };
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      responsePayload = { raw: responseText };
    }
    const wecomErrorCode = Number(responsePayload.errcode ?? -1);
    const succeeded = response.ok && wecomErrorCode === 0;
    const errorMessage = succeeded ? null : String(responsePayload.errmsg || `HTTP ${response.status}`);
    await completeNotification(notification.id, succeeded, responsePayload, errorMessage);
    return { id: notification.id, success: succeeded, error: errorMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await completeNotification(notification.id, false, null, errorMessage);
    return { id: notification.id, success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }
  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'produce_and_dispatch');
    const production =
      action === 'dispatch_only' ? { eligible: 0, created: 0, duplicates: 0 } : await produceClassFillReminders();
    if (action === 'produce_only') {
      return new Response(JSON.stringify({ success: true, production }), { headers });
    }
    const requestedBatchSize = Number(body.batch_size || 20);
    const batchSize = Math.min(Math.max(requestedBatchSize, 1), 50);
    const { data, error } = await adminClient.rpc('claim_organization_notifications', { batch_size: batchSize });
    if (error) throw error;

    const notifications = (data || []) as ClaimedNotification[];
    const results: Array<{ id: number; success: boolean; error: string | null }> = [];
    for (let index = 0; index < notifications.length; index += 5) {
      const batch = notifications.slice(index, index + 5);
      results.push(...(await Promise.all(batch.map(dispatchNotification))));
    }

    return new Response(
      JSON.stringify({
        success: true,
        production,
        claimed: notifications.length,
        sent: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results
      }),
      { headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers
    });
  }
});
