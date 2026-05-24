// 每周获奖推送脚本
// 由 GitHub Actions 在每周日 0:00 UTC 触发
//
// 流程：
// 1. 从 Supabase 查询本周获奖名单（班级榜冠亚季军）
// 2. 使用 Playwright 打开 certificate-render.html 渲染证书 PNG
// 3. 通过企业微信 Webhook 推送到对应大班群

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CERT_RENDER_PATH = path.resolve(__dirname, '..', 'certificate-render.html');

// ---- helpers (mirrors Edge Function + leaderboard logic) ----

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
  const monday = new Date(bt);
  monday.setUTCDate(bt.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dt = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dt;
  };
  return { monday: fmt(monday), sunday: fmt(sunday), sundayDate: sunday };
}

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function formatDateCN(d) {
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
}

function computeWeekLabel(weekMondayStr, semester) {
  const wm = new Date(weekMondayStr + 'T00:00:00+08:00');
  const trialStart = semester.trial_start_date
    ? new Date(semester.trial_start_date + 'T00:00:00+08:00')
    : null;
  const formalStart = new Date(semester.start_date + 'T00:00:00+08:00');
  const formalMonday = getMonday(semester.start_date);
  const isTrial = trialStart && wm < formalStart;
  if (isTrial) {
    const trialMonday = getMonday(semester.trial_start_date);
    const weeks = Math.floor((wm.getTime() - trialMonday.getTime()) / (7 * 86400000)) + 1;
    return '试晨读第' + weeks + '周';
  } else {
    const weeks = Math.floor((wm.getTime() - formalMonday.getTime()) / (7 * 86400000)) + 1;
    return '第' + weeks + '周';
  }
}

function hasMult100(f) { return f.includes('*100') || f.includes('×100'); }

function calcFormula(formula, fields) {
  try {
    let expr = formula;
    const varNames = [];
    const re = /[a-zA-Z_]\w*/g;
    let m;
    while ((m = re.exec(formula)) !== null) {
      if (!varNames.includes(m[0])) varNames.push(m[0]);
    }
    varNames.sort((a, b) => b.length - a.length);
    for (const v of varNames) {
      const val = fields[v] ?? 0;
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expr = expr.replace(new RegExp(escaped, 'g'), String(val));
    }
    if (!/^[\d.+\-*/()%\s]+$/.test(expr)) return null;
    const result = Function('"use strict"; return (' + expr + ')')();
    return typeof result === 'number' && !isNaN(result) ? result : null;
  } catch {
    return null;
  }
}

function guessFormulas(itemIds, assessmentTypes) {
  const ids = (itemIds || '').split(',').map(Number).filter(Boolean);
  const formulas = { online: null, video: null, hw: null };
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

function calcRates(fd, formulas) {
  const fields = {};
  for (const k of Object.keys(fd)) fields[k] = parseInt(fd[k]) || 0;

  let online = null, video = null, hw = null;
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
  let attendance = null;
  if (online !== null || hw !== null) {
    const denom = (online !== null ? 1 : 0) + (hw !== null ? 1 : 0);
    attendance = ((online || 0) + (hw || 0)) / denom;
  }
  return { online, video, hw, attendance };
}

// ---- main ----

async function getWinners() {
  // 1. Current semester
  const { data: semesters } = await adminClient
    .from('semesters')
    .select('*')
    .eq('is_current', 1)
    .order('start_date', { ascending: false })
    .limit(1);

  if (!semesters?.length) throw new Error('无活跃学期');
  const semester = semesters[0];

  // 2. Week range
  const { monday, sunday, sundayDate } = getWeekRange();
  console.log('本周范围:', monday, '~', sunday);

  // 3. Assessment types
  const { data: assessmentTypes } = await adminClient
    .from('assessment_types')
    .select('id, type_name, formula')
    .eq('semester_id', semester.id);

  // 4. Active orgs
  const { data: orgs } = await adminClient
    .from('organizations')
    .select('id, name, level, parent_id, semester_id, archived_at')
    .eq('semester_id', semester.id)
    .eq('is_active', true);

  if (!orgs?.length) throw new Error('无组织数据');

  const orgsMap = new Map(orgs.map(o => [o.id, o]));
  const bigClasses = orgs.filter(o => o.level === '大班');

  // 5. Award configs
  const { data: configs } = await adminClient
    .from('reminder_configs')
    .select('*')
    .eq('award_enabled', true);

  const awardConfigMap = new Map((configs || []).map(c => [c.org_id, c]));

  // 6. Week schedules
  const { data: weekSchedules } = await adminClient
    .from('schedules')
    .select('id, schedule_date, org_id, is_valid, item_ids')
    .gte('schedule_date', monday)
    .lte('schedule_date', sunday)
    .eq('is_valid', 1);

  if (!weekSchedules?.length) {
    console.log('本周无考核日程');
    return { winners: [], semester, monday, sunday, sundayDate };
  }

  const scheduleIds = weekSchedules.map(s => s.id);
  const schedulesByDaban = {};
  for (const s of weekSchedules) {
    if (!schedulesByDaban[s.org_id]) schedulesByDaban[s.org_id] = [];
    schedulesByDaban[s.org_id].push(s);
  }

  // 7. Records
  const { data: records } = await adminClient
    .from('attendance_records')
    .select('organization_id, schedule_id, fill_data, created_at, att_submitted_at, hw_submitted_at')
    .in('schedule_id', scheduleIds);

  const recsByGroup = {};
  for (const r of (records || [])) {
    if (!recsByGroup[r.organization_id]) recsByGroup[r.organization_id] = [];
    recsByGroup[r.organization_id].push(r);
  }

  // 8. Group→daban map
  const groupDabanMap = {};
  for (const o of orgs) {
    if (o.level === '小组') {
      const cls = orgsMap.get(o.parent_id);
      if (cls) {
        const daban = orgsMap.get(cls.parent_id);
        if (daban && daban.level === '大班') groupDabanMap[o.id] = daban.id;
      }
    }
  }

  // 9. Group stats
  const today = getBeijingNow().date;
  const groupStats = {};

  const allGroups = orgs.filter(o => o.level === '小组');
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
    let earliestCompletedAt = null;

    for (const s of schedules) {
      if (s.schedule_date > today) continue;
      if (groupArchivedDate && s.schedule_date >= groupArchivedDate) continue;
      const formulas = guessFormulas(s.item_ids, assessmentTypes || []);
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

  // 10. Class stats helper
  function getClassStats(classId) {
    const groups = orgs.filter(o => o.parent_id === classId && o.level === '小组');
    let attSum = 0, attCnt = 0, filledSum = 0, groupCnt = 0, totalDays = 0;
    let earliestCompletedAt = null;
    for (const g of groups) {
      const gs = groupStats[g.id];
      if (!gs || gs.attendanceAvg === null) continue;
      attSum += gs.attendanceAvg;
      attCnt++;
      filledSum += gs.filledDays;
      groupCnt++;
      if (gs.totalDays > totalDays) totalDays = gs.totalDays;
      if (gs.earliestCompletedAt && (!earliestCompletedAt || gs.earliestCompletedAt < earliestCompletedAt)) {
        earliestCompletedAt = gs.earliestCompletedAt;
      }
    }
    if (attCnt === 0) return null;
    return { attendanceAvg: attSum / attCnt, filledDays: Math.round(filledSum / (groupCnt || 1)), totalDays, earliestCompletedAt, groupCount: groupCnt };
  }

  // 11. Build winners (top 3 for each category)
  const rankNames = ['第一名', '第二名', '第三名'];
  const titleNames = ['冠军', '亚军', '季军'];
  const medalEmoji = ['🥇', '🥈', '🥉'];
  const weekdayLabel = computeWeekLabel(monday, semester);
  const winners = [];

  for (const bc of bigClasses) {
    const cfg = awardConfigMap.get(bc.id);
    if (!cfg || !cfg.webhook_url) continue;

    // Top 3 classes in this 大班
    const classes = orgs.filter(o => o.parent_id === bc.id && o.level === '班级');
    const classRankings = [];
    for (const cls of classes) {
      const stats = getClassStats(cls.id);
      if (stats) classRankings.push({ id: cls.id, name: cls.name, stats });
    }
    classRankings.sort((a, b) => {
      if (a.stats.attendanceAvg !== b.stats.attendanceAvg) return b.stats.attendanceAvg - a.stats.attendanceAvg;
      return (a.stats.earliestCompletedAt || 'z') < (b.stats.earliestCompletedAt || 'z') ? -1 : 1;
    });

    const abbr = (bc.name || '').replace(/[^A-Za-z0-9一-鿿]/g, '').substring(0, 8);
    for (let i = 0; i < Math.min(3, classRankings.length); i++) {
      const r = classRankings[i];
      const rank = i + 1;
      winners.push({
        orgName: r.name, rank, title: titleNames[i],
        bigClassName: bc.name, parentName: bc.name,
        attRate: r.stats.attendanceAvg.toFixed(2) + '%',
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

  return { winners, semester, monday, sunday, sundayDate, weekdayLabel };
}

// ---- certificate rendering ----

async function renderCertificate(page, certParams) {
  const params = new URLSearchParams(certParams);
  const fileUrl = 'file:///' + CERT_RENDER_PATH.replace(/\\/g, '/').replace(/^\/+/g, '') + '?' + params.toString();
  // On Linux (GitHub runner), path doesn't need drive letter fix
  const isWindows = process.platform === 'win32';
  const url = isWindows ? fileUrl : 'file://' + CERT_RENDER_PATH + '?' + params.toString();

  console.log('  加载证书页面...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for fonts and html2canvas to be ready
  console.log('  等待字体和渲染库加载...');
  await page.waitForFunction(() => document.fonts && document.fonts.ready, { timeout: 15000 });
  await page.waitForFunction(() => typeof window.renderCertificatePng === 'function', { timeout: 15000 });

  // Extra wait for fonts to fully render
  await page.waitForTimeout(2000);

  console.log('  渲染证书 PNG...');
  const dataUrl = await page.evaluate(() => window.renderCertificatePng());
  return dataUrl; // data:image/png;base64,...
}

// ---- push to WeChat Work ----

async function pushToWechat(webhookUrl, markdownContent, imageBase64) {
  // 1. Send markdown message
  console.log('  发送祝贺消息...');
  const mdRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { content: markdownContent }
    })
  });
  const mdText = await mdRes.text();
  console.log('  消息响应:', mdText);

  // 2. Send certificate image
  if (imageBase64) {
    console.log('  发送证书图片...');
    // Compute MD5 from raw bytes (not base64 string)
    const rawBytes = Buffer.from(imageBase64, 'base64');
    const md5 = crypto.createHash('md5').update(rawBytes).digest('hex');

    const imgRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'image',
        image: { base64: imageBase64, md5: md5 }
      })
    });
    const imgText = await imgRes.text();
    console.log('  图片响应:', imgText);
    return { md: mdText, img: imgText };
  }

  return { md: mdText };
}

// ---- main flow ----

async function main() {
  console.log('=== 每周获奖推送 ===');
  console.log('时间:', new Date().toISOString());

  // 1. Get winners
  console.log('\n[1/3] 查询获奖名单...');
  const { winners, semester, monday, sunday, sundayDate, weekdayLabel } = await getWinners();

  if (winners.length === 0) {
    console.log('本周无获奖者（可能未配置获奖推送或本周无考核数据）');
    return;
  }

  console.log('共 ' + winners.length + ' 个获奖者');
  for (const w of winners) {
    console.log('  - [' + w.bigClassName + '] ' + w.certParams.title + ': ' + w.orgName + ' (' + w.attRate + ')');
  }

  // 2. Render certificates
  console.log('\n[2/3] 渲染证书图片...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 680, height: 960 } });
  const page = await context.newPage();

  const renderedImages = []; // { winner, imageBase64 }

  for (const w of winners) {
    console.log('  渲染: ' + w.certParams.title + ' - ' + w.orgName);
    try {
      const dataUrl = await renderCertificate(page, w.certParams);
      // Extract base64 from data URL
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      renderedImages.push({ winner: w, imageBase64: base64 });
      console.log('  ✓ 渲染成功 (' + (base64.length / 1024).toFixed(1) + ' KB)');
    } catch (e) {
      console.error('  ✗ 渲染失败:', e.message);
    }
  }

  await browser.close();

  // 3. Push to WeChat
  console.log('\n[3/3] 推送到企业微信...');
  // Group by webhook_url (one 大班 may have multiple winners)
  const pushGroups = {};
  for (const item of renderedImages) {
    const url = item.winner.webhookUrl;
    if (!pushGroups[url]) pushGroups[url] = [];
    pushGroups[url].push(item);
  }

  for (const [webhookUrl, items] of Object.entries(pushGroups)) {
    const bigClassName = items[0].winner.bigClassName;
    console.log('\n  推送到: ' + bigClassName);

    // Build markdown message
    const medalEmoji = ['🥇', '🥈', '🥉'];
    let md = '## 🏆 本周获奖通报\n\n';
    md += '> ' + semester.semester_name + ' ' + weekdayLabel + '\n';
    md += '> 考核周期：' + monday + ' ~ ' + sunday + '\n\n';
    md += '**' + bigClassName + '** 获奖名单：\n';

    if (items.length > 0) {
      md += '\n**班级榜**\n';
      for (const item of items) {
        const w = item.winner;
        const emoji = medalEmoji[w.rank - 1] || '';
        md += '- ' + emoji + ' **' + w.orgName + '**（' + w.title + '）\n';
        md += '  出勤率：<font color="warning">' + w.attRate + '</font>\n';
      }
    }

    md += '\n> 颁发日期：' + sundayDate + '\n';
    md += '> 恭喜以上获奖班级，望再接再厉，再创佳绩！\n';

    try {
      // Push markdown + images
      await pushToWechat(webhookUrl, md, items[0].imageBase64);
      // Push additional images (if more than 1 winner in same 大班)
      for (let i = 1; i < items.length; i++) {
        console.log('  发送额外证书...');
        await pushToWechat(webhookUrl, null, items[i].imageBase64);
      }
      console.log('  ✓ 推送完成');
    } catch (e) {
      console.error('  ✗ 推送失败:', e.message);
    }
  }

  console.log('\n=== 推送完成 ===');
  console.log('获奖总数:', winners.length);
  console.log('成功推送:', renderedImages.length);
}

main().catch(e => {
  console.error('执行失败:', e);
  process.exit(1);
});
