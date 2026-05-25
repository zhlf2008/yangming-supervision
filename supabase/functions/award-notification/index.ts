// Supabase Edge Function: award-notification
// 每周获奖推送：获取获奖名单 + 推送证书图片到企业微信群
//
// action=get_winners → 返回获奖名单及证书数据
// action=send → 接收 base64 图片并推送到企业微信

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'https://esm.sh/md5';
import { pinyin } from 'https://esm.sh/pinyin-pro';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ---- helpers ----

function getBeijingNow() {
  const d = new Date();
  const bt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = bt.getUTCFullYear();
  const m = String(bt.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(bt.getUTCDate()).padStart(2, '0');
  return { date: y + '-' + m + '-' + dt, dayOfWeek: bt.getUTCDay() };
}

function getWeekRange() {
  const now = new Date();
  const bt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = bt.getUTCDay();
  // Monday of current week
  const monday = new Date(bt);
  monday.setUTCDate(bt.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  // Sunday of current week
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dt = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dt;
  };
  return { monday: fmt(monday), sunday: fmt(sunday), sundayDate: sunday };
}

function getMonday(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function formatDateCN(d: Date) {
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
}

interface Org {
  id: number; name: string; level: string; parent_id: number | null;
  semester_id: number; archived_at?: string | null;
}

interface Schedule {
  id: number; schedule_date: string; org_id: number; is_valid: number;
  item_ids?: string | null;
}

interface AttendanceRec {
  organization_id: number; schedule_id: number;
  fill_data?: Record<string, any>; created_at?: string;
  att_submitted_at?: string | null; hw_submitted_at?: string | null;
}

interface AssessmentType {
  id: number; type_name: string; formula?: string | null;
}

// 获取大班下所有小组（递归）
function getGroupsOfClass(classId: number, orgs: Org[]): Org[] {
  return orgs.filter(o => o.parent_id === classId && o.level === '小组');
}

function getClassesOfBigClass(bigClassId: number, orgs: Org[]): Org[] {
  return orgs.filter(o => o.parent_id === bigClassId && o.level === '班级');
}

// ---- formula calculation (mirrors frontend calcFormula) ----

function hasMult100(f: string) { return f.includes('*100') || f.includes('×100'); }

function calcFormula(formula: string, fields: Record<string, number>): number | null {
  if (!formula) return null;
  let expr = formula.trim();

  // 按字段名长度降序排列，避免短名称误匹配长名称的子串
  const names = Object.keys(fields).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const val = Number(fields[name]) || 0;
    expr = expr.replace(new RegExp(name, 'g'), '(' + val + ')');
  }

  // 安全检查：只允许数字、运算符、小数点、小括号、空白
  if (/[^0-9+\-*/().%\s]/.test(expr)) return null;

  try {
    const result = Function('"use strict"; return (' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function guessFormulas(itemIds: string, assessmentTypes: AssessmentType[]) {
  const ids = itemIds.split(',').map(Number).filter(Boolean);
  const formulas: { online: string | null; video: string | null; hw: string | null } = {
    online: null, video: null, hw: null
  };
  for (const id of ids) {
    const at = assessmentTypes.find(t => t.id === id);
    if (!at || !at.formula) continue;
    const name = at.type_name || '';
    if (name.includes('上线率')) formulas.online = at.formula;
    else if (name.includes('视频率')) formulas.video = at.formula;
    else if (name.includes('作业率')) formulas.hw = at.formula;
  }
  return formulas;
}

function calcRates(fd: Record<string, any>, formulas: { online: string | null; video: string | null; hw: string | null }) {
  const fields: Record<string, number> = {};
  for (const k of Object.keys(fd)) fields[k] = parseInt(fd[k]) || 0;

  let online: number | null = null, video: number | null = null, hw: number | null = null;
  if (formulas.online) {
    const r = calcFormula(formulas.online, fields);
    online = r != null ? r * (hasMult100(formulas.online) ? 1 : 100) : 0;
  }
  if (formulas.video) {
    const r = calcFormula(formulas.video, fields);
    video = r != null ? r * (hasMult100(formulas.video) ? 1 : 100) : 0;
  }
  if (formulas.hw) {
    const r = calcFormula(formulas.hw, fields);
    hw = r != null ? r * (hasMult100(formulas.hw) ? 1 : 100) : 0;
  }
  let attendance: number | null = null;
  if (online !== null || hw !== null) {
    const denom = (online !== null ? 1 : 0) + (hw !== null ? 1 : 0);
    attendance = ((online || 0) + (hw || 0)) / denom;
  }
  return { online, video, hw, attendance };
}

// ---- main winner computation ----

async function getWinners() {
  // 1. Get current semester
  const { data: semesters } = await adminClient
    .from('semesters')
    .select('*')
    .eq('is_current', 1)
    .order('start_date', { ascending: false })
    .limit(1);

  if (!semesters?.length) return { error: '无活跃学期' };
  const semester = semesters[0];

  // 2. Get week range
  const { monday, sunday, sundayDate } = getWeekRange();

  // 3. Get assessment types
  const { data: assessmentTypes } = await adminClient
    .from('assessment_types')
    .select('id, type_name, formula')
    .eq('semester_id', semester.id);

  // 4. Get active orgs for this semester
  const { data: orgs } = await adminClient
    .from('organizations')
    .select('id, name, level, parent_id, semester_id, archived_at')
    .eq('semester_id', semester.id)
    .eq('is_active', true);

  if (!orgs?.length) return { error: '无组织数据' };

  const orgsMap = new Map(orgs.map(o => [o.id, o]));
  const bigClasses = orgs.filter(o => o.level === '大班');

  // 5. Get reminder configs with award_enabled
  const { data: configs } = await adminClient
    .from('reminder_configs')
    .select('*')
    .eq('award_enabled', true);

  const awardConfigMap = new Map((configs || []).map(c => [c.org_id, c]));

  // 6. Get schedules for this week
  const { data: weekSchedules } = await adminClient
    .from('schedules')
    .select('id, schedule_date, org_id, is_valid, item_ids')
    .gte('schedule_date', monday)
    .lte('schedule_date', sunday)
    .eq('is_valid', 1);

  if (!weekSchedules?.length) return { error: '本周无考核日程', monday, sunday };

  const scheduleIds = weekSchedules.map(s => s.id);
  const schedulesByDaban: Record<number, Schedule[]> = {};
  for (const s of weekSchedules) {
    if (!schedulesByDaban[s.org_id]) schedulesByDaban[s.org_id] = [];
    schedulesByDaban[s.org_id].push(s);
  }

  // 7. Get attendance records for this week
  const { data: records } = await adminClient
    .from('attendance_records')
    .select('organization_id, schedule_id, fill_data, created_at, att_submitted_at, hw_submitted_at')
    .in('schedule_id', scheduleIds);

  const recsByGroup: Record<number, AttendanceRec[]> = {};
  for (const r of (records || [])) {
    if (!recsByGroup[r.organization_id]) recsByGroup[r.organization_id] = [];
    recsByGroup[r.organization_id].push(r);
  }

  // 8. Build group→daban map
  const groupDabanMap: Record<number, number> = {};
  for (const o of orgs) {
    if (o.level === '小组') {
      const cls = orgsMap.get(o.parent_id);
      if (cls) {
        const daban = orgsMap.get(cls.parent_id);
        if (daban && daban.level === '大班') groupDabanMap[o.id] = daban.id;
      }
    }
  }

  // 9. Compute group stats
  const today = getBeijingNow().date;
  const groupStats: Record<number, {
    attendanceAvg: number | null; filledDays: number; totalDays: number;
    earliestCompletedAt: string | null;
    orderScore?: number;
  }> = {};

  const allGroups = orgs.filter(o => o.level === '小组');
  // 每日小组完成时间: groupDayTime[groupId][dateStr] = completionTime
  const groupDayTime: Record<number, Record<string, string>> = {};
  for (const g of allGroups) { groupDayTime[g.id] = {}; }
  for (const g of allGroups) {
    const recs = recsByGroup[g.id] || [];
    const recMap = new Map(recs.map(r => [r.schedule_id, r]));
    const dabanId = groupDabanMap[g.id];
    const schedules = dabanId ? (schedulesByDaban[dabanId] || []) : [];
    const groupArchivedDate = g.archived_at ? String(g.archived_at).substring(0, 10) : null;

    let totalDays = 0;
    for (const s of schedules) {
      if (s.schedule_date <= today) {
        if (groupArchivedDate && s.schedule_date >= groupArchivedDate) continue;
        totalDays++;
      }
    }
    if (totalDays === 0) continue;

    let onlineSum = 0, onlineN = 0, hwSum = 0, hwN = 0;
    let attSum = 0, attN = 0;
    let filledDays = 0;
    let earliestCompletedAt: string | null = null;

    for (const s of schedules) {
      if (s.schedule_date > today) continue;
      if (groupArchivedDate && s.schedule_date >= groupArchivedDate) continue;
      const formulas = guessFormulas(s.item_ids || '', assessmentTypes || []);
      const rec = recMap.get(s.id);
      const fd = rec?.fill_data || {};

      const yingdao = parseInt(fd['应到人数']) || 0;
      const shidao = parseInt(fd['实到人数']) || 0;
      const yingzuo = parseInt(fd['应做作业人数']) || 0;
      const zuowan = parseInt(fd['作业完成人数']) || 0;
      const shipin = parseInt(fd['视频人数']) || 0;

      const hasData = rec && (yingdao > 0 || shidao > 0 || yingzuo > 0 || zuowan > 0 || shipin > 0);
      if (hasData) {
        filledDays++;
        const completedAt = [rec.created_at, rec.att_submitted_at, rec.hw_submitted_at]
          .filter(Boolean)
          .sort()
          .reverse()[0];
        if (completedAt && (!earliestCompletedAt || completedAt < earliestCompletedAt)) {
          earliestCompletedAt = completedAt;
        }
        // 记录每日完成时间（取当天所有考核项中最晚提交时间）
        if (completedAt) {
          const dayKey = String(s.schedule_date).substring(0, 10);
          const prevDayTime = groupDayTime[g.id][dayKey];
          if (!prevDayTime || completedAt > prevDayTime) {
            groupDayTime[g.id][dayKey] = completedAt;
          }
        }
      }

      const rates = calcRates(fd, formulas);
      if (formulas.online) { onlineSum += rates.online ?? 0; onlineN++; }
      if (formulas.hw) { hwSum += rates.hw ?? 0; hwN++; }
      if (formulas.online || formulas.hw) { attSum += rates.attendance ?? 0; attN++; }
    }

    groupStats[g.id] = {
      attendanceAvg: attN > 0 ? attSum / attN : null,
      filledDays, totalDays,
      earliestCompletedAt
    };
  }

  // 10. Daily ranking → weekly order score
  // class→groups map
  const classGroupsMap: Record<number, number[]> = {};
  for (const o of orgs) {
    if (o.level === '小组') {
      const cid = o.parent_id;
      if (!classGroupsMap[cid]) classGroupsMap[cid] = [];
      classGroupsMap[cid].push(o.id);
    }
  }

  // Collect all valid schedule dates (<= today)
  const scheduleDates: string[] = [];
  const dateSet = new Set<string>();
  for (const s of weekSchedules) {
    const d = String(s.schedule_date).substring(0, 10);
    if (d <= today && !dateSet.has(d)) {
      dateSet.add(d);
      scheduleDates.push(d);
    }
  }
  scheduleDates.sort();

  const groupOrderScore: Record<number, number> = {};
  const classOrderScore: Record<number, number> = {};

  for (const date of scheduleDates) {
    // ---- 小组每日排名（班级内部） ----
    for (const cls of orgs) {
      if (cls.level !== '班级') continue;
      const gids = classGroupsMap[cls.id] || [];
      if (gids.length === 0) continue;

      const ranked: { id: number; time: string | null }[] = [];
      for (const gid of gids) {
        const gt = groupDayTime[gid] || {};
        ranked.push({ id: gid, time: gt[date] || null });
      }

      ranked.sort((a, b) => {
        if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });

      let prevTime: string | null = null, prevRank = 0;
      for (let idx = 0; idx < ranked.length; idx++) {
        const item = ranked[idx];
        let rank: number;
        if (item.time === null) {
          rank = gids.length;
        } else if (item.time === prevTime) {
          rank = prevRank;
        } else {
          rank = idx + 1;
        }
        prevTime = item.time;
        prevRank = rank;

        if (!groupOrderScore[item.id]) groupOrderScore[item.id] = 0;
        groupOrderScore[item.id] += rank;
      }
    }

    // ---- 班级每日排名（全年级） ----
    const classTimes: { id: number; time: string | null }[] = [];
    for (const cls of orgs) {
      if (cls.level !== '班级') continue;
      const gids = classGroupsMap[cls.id] || [];
      if (gids.length === 0) continue;

      let maxTime: string | null = null;
      for (const gid of gids) {
        const gt = groupDayTime[gid] || {};
        const t = gt[date] || null;
        if (t && (!maxTime || t > maxTime)) maxTime = t;
      }
      classTimes.push({ id: cls.id, time: maxTime });
    }

    classTimes.sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

    let prevCt: string | null = null, prevCr = 0;
    for (let idx = 0; idx < classTimes.length; idx++) {
      const item = classTimes[idx];
      let rank: number;
      if (item.time === null) {
        rank = classTimes.length;
      } else if (item.time === prevCt) {
        rank = prevCr;
      } else {
        rank = idx + 1;
      }
      prevCt = item.time;
      prevCr = rank;

      if (!classOrderScore[item.id]) classOrderScore[item.id] = 0;
      classOrderScore[item.id] += rank;
    }
  }

  // Write orderScore into groupStats
  for (const gid of Object.keys(groupOrderScore)) {
    const id = parseInt(gid);
    if (groupStats[id]) {
      groupStats[id].orderScore = groupOrderScore[id];
    }
  }

  // 11. Compute class stats
  function getClassStats(classId: number) {
    const groups = getGroupsOfClass(classId, orgs!);
    let attSum = 0, attCnt = 0, filledSum = 0, groupCnt = 0, totalDays = 0;
    for (const g of groups) {
      const gs = groupStats[g.id];
      if (!gs || gs.attendanceAvg === null) continue;
      attSum += gs.attendanceAvg;
      attCnt++;
      filledSum += gs.filledDays;
      groupCnt++;
      if (gs.totalDays > totalDays) totalDays = gs.totalDays;
    }
    if (attCnt === 0) return null;
    return {
      attendanceAvg: attSum / attCnt,
      filledDays: Math.round(filledSum / (groupCnt || 1)),
      totalDays,
      orderScore: classOrderScore[classId] || null
    };
  }

  // 11. Build winner list (top 3 classes)
  const rankNames = ['第一名', '第二名', '第三名'];
  const titleNames = ['冠军', '亚军', '季军'];

  interface Winner {
    orgName: string;
    rank: number;
    title: string;
    bigClassName: string;
    parentName: string;
    attRate: string;
    webhookUrl: string;
    certParams: Record<string, string>;
  }

  const winners: Winner[] = [];
  const weekdayLabel = computeWeekLabel(monday, semester);

  for (const bc of bigClasses) {
    const cfg = awardConfigMap.get(bc.id);
    if (!cfg || !cfg.webhook_url) continue;

    // Top 3 classes
    const classes = getClassesOfBigClass(bc.id, orgs!);
    const classRankings: { id: number; name: string; stats: ReturnType<typeof getClassStats> }[] = [];
    for (const cls of classes) {
      const stats = getClassStats(cls.id);
      if (stats) classRankings.push({ id: cls.id, name: cls.name, stats });
    }
    classRankings.sort((a, b) => {
      if (a.stats!.attendanceAvg !== b.stats!.attendanceAvg) return b.stats!.attendanceAvg - a.stats!.attendanceAvg;
      const sa = a.stats!.orderScore || 9999;
      const sb = b.stats!.orderScore || 9999;
      if (sa !== sb) return sa - sb;
      const fa = a.stats!.filledDays || 0;
      const fb = b.stats!.filledDays || 0;
      if (fa !== fb) return fb - fa;
      return 0;
    });

    const abbr = pinyin(bc.name || '', { pattern: 'first', toneType: 'none' })
      .replace(/\s+/g, '').toUpperCase().substring(0, 8);
    for (let i = 0; i < Math.min(3, classRankings.length); i++) {
      const r = classRankings[i];
      const rank = i + 1;
      winners.push({
        orgName: r.name, rank, title: titleNames[i],
        bigClassName: bc.name, parentName: bc.name,
        attRate: r.stats!.attendanceAvg.toFixed(2) + '%',
        webhookUrl: cfg.webhook_url,
        certParams: {
          name: r.name,
          context: semester.semester_name + ' ' + weekdayLabel + ' 的 ' + bc.name,
          rank: rankNames[i], title: titleNames[i] + '班级',
          date: formatDateCN(sundayDate),
          serial: 'YMXX-' + String(semester.semester_name || '').replace(/[^0-9]/g, '') + '-' + weekdayLabel.replace(/[^0-9]/g, '') + '-' + abbr + '-0' + rank,
          sealColor: rank <= 3 ? '#C41E3A' : '#5B2C8E', sealName: bc.name
        }
      });
    }

  }

  return {
    success: true,
    semester: semester.semester_name,
    weekRange: { monday, sunday },
    sundayDate: formatDateCN(sundayDate),
    weekdayLabel,
    winnerCount: winners.length,
    winners
  };
}

function computeWeekLabel(weekMondayStr: string, semester: any) {
  const wm = new Date(weekMondayStr + 'T00:00:00+08:00');
  const trialStart = semester.trial_start_date
    ? new Date(semester.trial_start_date + 'T00:00:00+08:00')
    : null;
  const formalStart = new Date(semester.start_date + 'T00:00:00+08:00');
  const formalMonday = getMonday(semester.start_date);
  const isTrial = trialStart && wm < formalStart;
  if (isTrial) {
    const trialMonday = getMonday(semester.trial_start_date!);
    const weeks = Math.floor((wm.getTime() - trialMonday.getTime()) / (7 * 86400000)) + 1;
    return '试晨读第' + weeks + '周';
  } else {
    const weeks = Math.floor((wm.getTime() - formalMonday.getTime()) / (7 * 86400000)) + 1;
    return '第' + weeks + '周';
  }
}

// ---- main handler ----

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

  const EXPECTED_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_SECRET') || '';
  const reqKey = req.headers.get('apikey') || '';
  if (!EXPECTED_KEY || reqKey !== EXPECTED_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { action = 'get_winners' } = body;

    if (action === 'get_winners') {
      const result = await getWinners();
      return new Response(JSON.stringify(result), { headers });
    }

    if (action === 'send') {
      // Receive pre-rendered image data and push to webhook
      const { webhook_url, markdown_content, image_base64 } = body;

      if (!webhook_url) {
        return new Response(JSON.stringify({ error: '缺少 webhook_url' }), { headers, status: 400 });
      }

      const errors: string[] = [];

      // Send markdown message first
      if (markdown_content) {
        const mdRes = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { content: markdown_content }
          })
        });
        const mdText = await mdRes.text();
        try {
          const j = JSON.parse(mdText);
          if (j.errcode !== 0) errors.push('祝贺消息失败: errcode=' + j.errcode + ' ' + (j.errmsg || ''));
        } catch { /* non-JSON response, ignore */ }
      }

      // Send image message
      if (image_base64) {
        const rawBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0));
        const md5Hash = md5(rawBytes);

        const imgRes = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'image',
            image: {
              base64: image_base64,
              md5: md5Hash
            }
          })
        });
        const imgText = await imgRes.text();
        try {
          const j = JSON.parse(imgText);
          if (j.errcode !== 0) errors.push('证书图片失败: errcode=' + j.errcode + ' ' + (j.errmsg || ''));
        } catch { /* non-JSON response, ignore */ }
      }

      if (errors.length > 0) {
        return new Response(JSON.stringify({ success: false, errors }), { headers, status: 502 });
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: '未知 action' }), { headers, status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
