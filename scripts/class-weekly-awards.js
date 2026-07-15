const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const CLASS_NOTIFICATION_SECRET = process.env.CLASS_NOTIFICATION_SECRET || '';
const CERT_RENDER_PATH = path.resolve(
  process.env.CERT_RENDER_PATH || path.join(__dirname, '..', 'certificate-render.html')
);
const STATE_DIR = path.resolve(process.env.CLASS_AWARD_STATE_DIR || path.join(__dirname, '..', '.class-award-state'));
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/award-notification`;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !CLASS_NOTIFICATION_SECRET) {
  console.error('缺少 SUPABASE_URL 或 CLASS_NOTIFICATION_SECRET 环境变量');
  process.exit(1);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getClassNotifications() {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dispatcher-Secret': CLASS_NOTIFICATION_SECRET
    },
    body: JSON.stringify({ action: 'get_class_winners' }),
    signal: AbortSignal.timeout(60000)
  });
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`获奖接口返回非 JSON 内容，HTTP ${response.status}`);
  }
  if (!response.ok || !data.success) {
    throw new Error(data.error || `获奖接口返回错误，HTTP ${response.status}`);
  }
  return data;
}

function loadState(statePath) {
  if (!fs.existsSync(statePath)) return { organizations: {} };
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!state.organizations || typeof state.organizations !== 'object') state.organizations = {};
    return state;
  } catch {
    throw new Error(`无法读取推送状态文件：${statePath}`);
  }
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, statePath);
}

async function renderClassCertificate(page, certParams) {
  const certificateUrl = new URL(pathToFileURL(CERT_RENDER_PATH));
  for (const [key, value] of Object.entries(certParams || {})) {
    certificateUrl.searchParams.set(key, String(value));
  }
  await page.goto(certificateUrl.href, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.fonts && document.fonts.ready, { timeout: 15000 });
  await page.waitForSelector('#certificate', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  return await page.locator('#certificate').screenshot({ type: 'png' });
}

function buildMarkdown(data, notification) {
  let markdown = '## 本周获奖通报\n\n';
  markdown += `> ${data.semester} ${data.weekdayLabel}\n`;
  markdown += `> 考核周期：${data.weekRange.monday} ~ ${data.weekRange.sunday}\n\n`;
  markdown += `**${notification.bigClassName}** 获奖名单：\n`;

  if (notification.classWinners.length) {
    markdown += '\n**班级榜**\n';
    for (const winner of notification.classWinners) {
      markdown += `- **${winner.orgName}**（${winner.title}）\n`;
      markdown += `  出勤率：<font color="warning">${winner.attRate}</font>\n`;
    }
  }

  if (notification.groupWinners.length) {
    markdown += `\n**${notification.orgName}小组榜**\n`;
    for (const winner of notification.groupWinners) {
      markdown += `- **${winner.orgName}**（${winner.title}）\n`;
      markdown += `  出勤率：<font color="warning">${winner.attRate}</font>\n`;
    }
  }

  markdown += `\n> 颁发日期：${data.sundayDate}\n`;
  markdown += '> 恭喜以上获奖班级和小组，望再接再厉，再创佳绩！';
  return markdown;
}

async function sendWeCom(webhookUrl, payload, label) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`${label}返回非 JSON 内容，HTTP ${response.status}`);
  }
  if (!response.ok || Number(result.errcode) !== 0) {
    throw new Error(`${label}失败：${result.errmsg || `HTTP ${response.status}`}`);
  }
}

async function sendMarkdown(webhookUrl, markdown) {
  await sendWeCom(webhookUrl, { msgtype: 'markdown', markdown: { content: markdown } }, '获奖消息');
}

async function sendImage(webhookUrl, imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const md5 = crypto.createHash('md5').update(imageBuffer).digest('hex');
  await sendWeCom(webhookUrl, { msgtype: 'image', image: { base64, md5 } }, '证书图片');
}

async function runClassWeeklyAwards() {
  console.log(`班级获奖推送开始${DRY_RUN ? '（仅验证，不发送）' : ''}`);
  const data = await getClassNotifications();
  const notifications = data.classNotifications || [];
  console.log(`获奖周期：${data.weekRange.monday} ~ ${data.weekRange.sunday}`);
  console.log(`待处理班级：${notifications.length}`);
  if (!notifications.length) return;

  const statePath = path.join(STATE_DIR, `class-weekly-awards-${data.weekRange.monday}.json`);
  const state = DRY_RUN ? { organizations: {} } : loadState(statePath);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 680, height: 960 } });
  const page = await context.newPage();
  let completed = 0;

  try {
    for (const notification of notifications) {
      const organizationKey = String(notification.orgId);
      const organizationState = state.organizations[organizationKey] || {
        markdownSent: false,
        imageSerials: [],
        completed: false
      };
      if (!DRY_RUN && organizationState.completed) {
        console.log(`跳过已完成班级：${notification.orgName}`);
        completed++;
        continue;
      }

      const winners = [...notification.classWinners, ...notification.groupWinners];
      console.log(`处理班级：${notification.orgName}，证书 ${winners.length} 张`);
      const renderedImages = [];
      for (const winner of winners) {
        const serial = String(winner.certParams.serial || `${winner.scope}-${winner.orgId}`);
        if (!DRY_RUN && organizationState.imageSerials.includes(serial)) continue;
        const image = await renderClassCertificate(page, winner.certParams);
        renderedImages.push({ serial, image });
      }

      if (DRY_RUN) {
        console.log(`验证完成：${notification.orgName}，成功渲染 ${renderedImages.length} 张证书`);
        completed++;
        continue;
      }

      state.organizations[organizationKey] = organizationState;
      if (!organizationState.markdownSent) {
        await sendMarkdown(notification.webhookUrl, buildMarkdown(data, notification));
        organizationState.markdownSent = true;
        saveState(statePath, state);
        await delay(300);
      }

      for (const renderedImage of renderedImages) {
        await sendImage(notification.webhookUrl, renderedImage.image);
        organizationState.imageSerials.push(renderedImage.serial);
        saveState(statePath, state);
        await delay(300);
      }

      organizationState.completed = organizationState.imageSerials.length >= winners.length;
      organizationState.completedAt = new Date().toISOString();
      saveState(statePath, state);
      if (!organizationState.completed) {
        throw new Error(`${notification.orgName}证书推送数量不完整`);
      }
      completed++;
      console.log(`推送完成：${notification.orgName}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`班级获奖推送结束：${completed}/${notifications.length}`);
}

runClassWeeklyAwards().catch((error) => {
  console.error('班级获奖推送失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
