// Supabase Edge Function: clever-endpoint
// ⚠️  部署必须加 --no-verify-jwt（cron-job.org 调用不带 JWT）:
//     npm run deploy:function
//     或: npx supabase functions deploy clever-endpoint --no-verify-jwt
// Cron 触发器 (cron-job.org 设置):
//   URL: https://whvjfurrkusdwujjodwc.supabase.co/functions/v1/clever-endpoint
//   请求体: {"action":"send"}  请求方法: POST

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 获取北京时间（UTC+8）的今天日期和当前时间字符串
function getBeijingNow() {
  const d = new Date();
  // Deno Deploy 运行在 UTC，手动加 8 小时偏移
  const beijingTime = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = beijingTime.getUTCFullYear();
  const m = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(beijingTime.getUTCDate()).padStart(2, '0');
  const hh = String(beijingTime.getUTCHours()).padStart(2, '0');
  const mm = String(beijingTime.getUTCMinutes()).padStart(2, '0');
  return {
    today: y + '-' + m + '-' + dt,
    time: hh + ':' + mm
  };
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
    const beijingNow = getBeijingNow();
    const currentTime = beijingNow.time;
    const today = beijingNow.today;
    const now = new Date(); // UTC 时间，仅用于记录时间戳

    // 读取所有启用的提醒配置
    const { data: configs, error: configErr } = await adminClient
      .from('reminder_configs')
      .select('*')
      .eq('enabled', true);

    if (configErr) {
      return new Response(JSON.stringify({
        success: false,
        error: configErr.message
      }), { headers, status: 500 });
    }

    if (!configs?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: '无启用的提醒配置',
        reminders_sent: 0
      }), { headers });
    }

    // 一次性加载所有活跃组织
    const { data: allOrgs } = await adminClient
      .from('organizations')
      .select('id, name, level, parent_id')
      .eq('is_active', true);

    if (!allOrgs?.length) {
      return new Response(JSON.stringify({ error: '无法加载组织数据' }), { headers, status: 500 });
    }

    // 一次性加载所有考核类型（用于校验填报完整性）
    const { data: allAssessmentTypes } = await adminClient
      .from('assessment_types')
      .select('id, fields');

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

      // 查询该大班今天是否有有效考核日程
      const { data: dabanSchedules } = await adminClient
        .from('schedules')
        .select('id, item_ids')
        .eq('schedule_date', today)
        .eq('is_valid', 1)
        .eq('org_id', cfg.org_id);

      if (!dabanSchedules?.length) continue;
      const todayScheduleIds = dabanSchedules.map((s: { id: number }) => s.id);

      // 查询截止配置：若所有考核项均已截止，则跳过提醒
      const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const todayWeekDay = beijingDate.getUTCDay();
      const { data: deadlineConfigs } = await adminClient
        .from('assessment_deadline_configs')
        .select('assessment_type_id, days_of_week, cutoff_time')
        .eq('org_id', cfg.org_id)
        .eq('is_enabled', true);
      if (deadlineConfigs?.length) {
        const allLocked = dabanSchedules.every(s => {
          const ids = String((s as any).item_ids || '').split(',').map(Number).filter(Boolean);
          return ids.length > 0 && ids.every(id => {
            const rule = deadlineConfigs.find(d => d.assessment_type_id === id);
            if (!rule) return false;
            const days = String(rule.days_of_week || '').split(',').map(Number);
            return days.includes(todayWeekDay) && currentTime >= rule.cutoff_time;
          });
        });
        if (allLocked) {
          results.push({
            org_id: cfg.org_id,
            org_name: allOrgs.find(o => o.id === cfg.org_id)?.name || '',
            unsubmitted_count: 0,
            message: '所有考核项已截止，跳过提醒'
          });
          continue;
        }
      }

      // 从日程的考核项目中提取所有必填字段
      const requiredFields = new Set<string>();
      const scheduleItemIds = new Set<number>();
      for (const s of dabanSchedules) {
        const ids = String((s as any).item_ids || '').split(',').map(Number).filter(Boolean);
        ids.forEach((id: number) => scheduleItemIds.add(id));
      }
      if (allAssessmentTypes && scheduleItemIds.size > 0) {
        for (const at of allAssessmentTypes) {
          if (!scheduleItemIds.has(at.id)) continue;
          const fields = (at.fields || {}) as Record<string, string>;
          for (const [fieldName, meta] of Object.entries(fields)) {
            if (String(meta).includes('必填')) {
              requiredFields.add(fieldName);
            }
          }
        }
      }

      const groupIds = groups.map(g => g.id);
      const groupMap = new Map(groups.map(g => [g.id, g]));

      // 查询已提交的小组（含填报数据，用于完整性校验）
      const { data: submitted } = await adminClient
        .from('attendance_records')
        .select('organization_id, fill_data')
        .in('schedule_id', todayScheduleIds)
        .in('organization_id', groupIds);

      // 校验提交完整性：必填字段必须全部有值才算已提交
      const submittedIds = new Set<number>();
      if (requiredFields.size > 0) {
        for (const r of (submitted || [])) {
          const fd = (r.fill_data || {}) as Record<string, any>;
          const isComplete = [...requiredFields].every(field => {
            const val = fd[field];
            return val !== null && val !== undefined && val !== '';
          });
          if (isComplete) {
            submittedIds.add(r.organization_id);
          }
        }
      } else {
        // 没有必填字段定义时，退回旧逻辑：只要有记录就算已提交
        (submitted || []).forEach((r: any) => submittedIds.add(r.organization_id));
      }
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
      const timeStr = beijingNow.time;

      const submittedCount = groups.length - unsubmitted.length;

      let content = `## 📋 填报提醒\n\n`;
      content += `**${bigClassName}** 截至 ${timeStr}，已填报 **${submittedCount}** / **${groups.length}** 个小组\n`;
      content += `以下 **${unsubmitted.length}** 个小组尚未填报：\n`;

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
        content = `## 📋 填报提醒\n\n**${bigClassName}** 截至 ${timeStr}，已填报 **${submittedCount}** / **${groups.length}** 个小组\n还有 **${unsubmitted.length}** 个小组尚未填报数据，请尽快完成！`;
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
        const { error: updateErr } = await adminClient
          .from('reminder_configs')
          .update({ last_reminded_at: now.toISOString(), updated_at: now.toISOString() })
          .eq('id', cfg.id);
        if (updateErr) {
          console.error('Failed to update last_reminded_at for config', cfg.id, updateErr.message);
        }

        // 记录操作日志
        const { error: logErr } = await adminClient
          .from('audit_logs')
          .insert({
            user_id: null,
            user_name: '系统推送',
            action: '推送提醒',
            target: bigClassName,
            detail: `已填${submittedCount}/${groups.length}，未填${unsubmitted.length}个小组`
          });
        if (logErr) {
          console.error('Failed to insert audit_log', logErr.message);
        }

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
      time: beijingNow.time,
      reminders_sent: remindersSent,
      results
    }), { headers });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
