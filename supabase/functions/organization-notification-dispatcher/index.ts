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
