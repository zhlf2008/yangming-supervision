// Supabase Edge Function: send-reminder
// 部署命令: supabase functions deploy send-reminder --project-ref whvjfurrkusdwujjodwc
// Cron 触发器 (Supabase Dashboard 设置):
//   名称: reminder-cron
//   表达式: */15 12-21 * * *  (每天 12:00-21:59 每15分钟)
//   请求体: {"action":"send"}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodmpmdXJya3VzZHd1ampvZHdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc3NDA4MCwiZXhwIjoyMDkyMzUwMDgwfQ.xkSsbr5Gv8F82bhneevGUJ1V0Pq4jB5uPkR3jAVAJKQ';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dt;
}

interface Org {
  id: number;
  name: string;
  level: string;
  parent_id: number | null;
}

// 递归获取大班下所有小组
function getAllGroups(bigClassId: number, orgs: Org[]): Org[] {
  const children = orgs.filter(o => o.parent_id === bigClassId && o.level === '班级');
  const groups: Org[] = [];
  for (const cls of children) {
    const clsGroups = orgs.filter(o => o.parent_id === cls.id && o.level === '小组');
    groups.push(...clsGroups);
  }
  return groups;
}

// 构建组织完整路径：大班-班级-小组
function buildOrgPath(groupId: number, orgs: Org[]): string {
  const parts: string[] = [];
  let current: Org | undefined = orgs.find(o => o.id === groupId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? orgs.find(o => o.id === current!.parent_id) : undefined;
  }
  return parts.join(' - ');
}

Deno.serve(async (req) => {
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
    const { action = 'send', webhook_url } = body;

    // ---- test: 发送测试消息 ----
    if (action === 'test') {
      if (!webhook_url) {
        return new Response(JSON.stringify({ error: '缺少 webhook_url' }), { headers, status: 400 });
      }
      const testPayload = {
        msgtype: 'markdown',
        markdown: {
          content: '## 测试消息\n\n这是一条来自**阳明心学督察管理系统**的测试消息。\n\nWebhook 连接正常！'
        }
      };
      const res = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      const resText = await res.text();
      return new Response(JSON.stringify({ success: true, response: resText }), { headers });
    }

    // ---- send: 检查并发送提醒 ----
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const today = getToday();

    // 读取所有启用的提醒配置
    const { data: configs, error: configErr } = await adminClient
      .from('reminder_configs')
      .select('*')
      .eq('enabled', true);

    if (configErr || !configs?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: configErr ? configErr.message : '无启用的提醒配置',
        reminders_sent: 0
      }), { headers });
    }

    // 检查今天是否有考核日程
    const { data: todaySchedules } = await adminClient
      .from('schedules')
      .select('id')
      .eq('schedule_date', today)
      .eq('is_valid', 1);

    if (!todaySchedules?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: '今天非考核日，跳过提醒',
        reminders_sent: 0
      }), { headers });
    }
    const todayScheduleIds = todaySchedules.map((s: { id: number }) => s.id);

    // 一次性加载所有组织
    const { data: allOrgs } = await adminClient
      .from('organizations')
      .select('id, name, level, parent_id');

    if (!allOrgs?.length) {
      return new Response(JSON.stringify({ error: '无法加载组织数据' }), { headers, status: 500 });
    }

    let remindersSent = 0;
    const results: Record<string, any>[] = [];

    for (const cfg of configs) {
      // 时间窗口检查
      const startTime = cfg.start_time || String(cfg.start_hour || 12).padStart(2, '0') + ':00';
      const endTime = cfg.end_time || String(cfg.end_hour || 20).padStart(2, '0') + ':00';
      if (currentTime < startTime || currentTime >= endTime) continue;

      // 间隔检查
      if (cfg.last_reminded_at) {
        const lastTime = new Date(cfg.last_reminded_at).getTime();
        const elapsed = (now.getTime() - lastTime) / 60000; // 分钟
        if (elapsed < cfg.interval_minutes - 5) continue; // 5分钟容差
      }

      // 获取该大班下所有小组
      const groups = getAllGroups(cfg.org_id, allOrgs);
      if (!groups.length) continue;

      const groupIds = groups.map(g => g.id);
      const groupMap = new Map(groups.map(g => [g.id, g]));

      // 查询已提交的小组
      const { data: submitted } = await adminClient
        .from('attendance_records')
        .select('organization_id')
        .in('schedule_id', todayScheduleIds)
        .in('organization_id', groupIds);

      const submittedIds = new Set((submitted || []).map((r: { organization_id: number }) => r.organization_id));
      const unsubmitted = groups.filter(g => !submittedIds.has(g.id));

      if (unsubmitted.length === 0) {
        // 全部提交，但不清空 last_reminded_at，当天不再提醒
        results.push({
          org_id: cfg.org_id,
          org_name: allOrgs.find(o => o.id === cfg.org_id)?.name || '',
          unsubmitted_count: 0,
          message: '全部已提交，跳过'
        });
        continue;
      }

      // 构建消息
      const bigClassName = allOrgs.find(o => o.id === cfg.org_id)?.name || '未知大班';
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

      let content = `## 📋 填报提醒\n\n`;
      content += `**${bigClassName}** 截至 ${timeStr}，以下小组尚未填报数据：\n`;

      // 按班级分组展示
      const grouped: Record<string, Org[]> = {};
      for (const g of unsubmitted) {
        const cls = allOrgs.find(o => o.id === g.parent_id);
        const clsName = cls ? cls.name : '未知班级';
        if (!grouped[clsName]) grouped[clsName] = [];
        grouped[clsName].push(g);
      }

      for (const [clsName, gs] of Object.entries(grouped)) {
        content += `\n> **${clsName}**\n`;
        for (const g of gs) {
          content += `> - ${g.name}\n`;
        }
      }

      content += `\n共 **${unsubmitted.length}** 个小组未填报，请尽快完成！`;

      // 检查 content 长度（企业微信 markdown 限制 4096 字符）
      if (content.length > 4000) {
        content = `## 📋 填报提醒\n\n**${bigClassName}** 截至 ${timeStr}，还有 **${unsubmitted.length}** 个小组尚未填报数据，请尽快完成！`;
      }

      // 发送 webhook
      try {
        const res = await fetch(cfg.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { content }
          })
        });
        const resText = await res.text();

        // 更新 last_reminded_at
        await adminClient
          .from('reminder_configs')
          .update({ last_reminded_at: now.toISOString(), updated_at: now.toISOString() })
          .eq('id', cfg.id);

        remindersSent++;
        results.push({
          org_id: cfg.org_id,
          org_name: bigClassName,
          unsubmitted_count: unsubmitted.length,
          unsubmitted_groups: unsubmitted.map(g => buildOrgPath(g.id, allOrgs)),
          response: resText
        });
      } catch (e: any) {
        results.push({
          org_id: cfg.org_id,
          org_name: bigClassName,
          error: e.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      reminders_sent: remindersSent,
      results
    }), { headers });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
