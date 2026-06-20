// 每周获奖推送脚本
// 由 GitHub Actions 在每周日 0:00 UTC 触发
//
// 流程：
// 1. 调用 Edge Function 获取本周获奖名单（复用榜单计算逻辑）
// 2. 使用 Playwright 打开 certificate-render.html 渲染证书 PNG
// 3. 通过企业微信 Webhook 推送到对应大班群

const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const AWARD_SECRET =
  process.env.AWARD_NOTIFICATION_SECRET ||
  process.env.REMINDER_CRON_SECRET ||
  process.env.CRON_SECRET ||
  '';

if (!SUPABASE_URL || !AWARD_SECRET) {
  console.error('缺少 SUPABASE_URL 或 AWARD_NOTIFICATION_SECRET/REMINDER_CRON_SECRET/CRON_SECRET 环境变量');
  process.exit(1);
}

const CERT_RENDER_PATH = path.resolve(__dirname, '..', 'certificate-render.html');
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/award-notification`;

// ---- call Edge Function for winners ----

async function getWinnersFromEdge() {
  console.log('调用 Edge Function 获取获奖名单...');
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Award-Secret': AWARD_SECRET
    },
    body: JSON.stringify({ action: 'get_winners' })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Edge Function 返回错误 ' + res.status + ': ' + text);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '获取获奖名单失败');
  }

  console.log('获奖名单获取成功，共 ' + data.winnerCount + ' 个获奖者');
  return data;
}

// ---- certificate rendering ----

async function renderCertificate(page, certParams) {
  const params = new URLSearchParams(certParams);
  const isWindows = process.platform === 'win32';
  const url = isWindows
    ? 'file:///' + CERT_RENDER_PATH.replace(/\\/g, '/').replace(/^\/+/g, '') + '?' + params.toString()
    : 'file://' + CERT_RENDER_PATH + '?' + params.toString();

  console.log('  加载证书页面...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('  等待字体和渲染库加载...');
  await page.waitForFunction(() => document.fonts && document.fonts.ready, { timeout: 15000 });
  await page.waitForFunction(() => typeof window.renderCertificatePng === 'function', { timeout: 15000 });

  await page.waitForTimeout(2000);

  console.log('  渲染证书 PNG...');
  const dataUrl = await page.evaluate(() => window.renderCertificatePng());
  return dataUrl;
}

// ---- push to WeChat Work ----

function checkWebhookResponse(resText, label) {
  try {
    const json = JSON.parse(resText);
    if (json.errcode !== 0) {
      throw new Error(label + '失败: errcode=' + json.errcode + ' ' + (json.errmsg || ''));
    }
    console.log('  ' + label + '成功');
  } catch (e) {
    if (e.message.startsWith(label)) throw e;
    console.log('  ' + label + '响应(非JSON):', resText);
  }
}

async function pushToWechat(webhookUrl, markdownContent, imageBase64) {
  let mdText = '';
  if (markdownContent) {
    console.log('  发送祝贺消息...');
    const mdRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: markdownContent }
      })
    });
    mdText = await mdRes.text();
    checkWebhookResponse(mdText, '祝贺消息');
  }

  if (imageBase64) {
    console.log('  发送证书图片...');
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
    checkWebhookResponse(imgText, '证书图片');
    return { md: mdText, img: imgText };
  }

  return { md: mdText };
}

// ---- main flow ----

async function main() {
  console.log('=== 每周获奖推送 ===');
  console.log('时间:', new Date().toISOString());

  // 1. Get winners from Edge Function
  console.log('\n[1/3] 查询获奖名单...');
  const { winners, semester, weekRange, sundayDate, weekdayLabel } = await getWinnersFromEdge();

  if (winners.length === 0) {
    console.log('本周无获奖者（可能未配置获奖推送或本周无考核数据）');
    return;
  }

  for (const w of winners) {
    console.log('  - [' + w.bigClassName + '] ' + w.certParams.title + ': ' + w.orgName + ' (' + w.attRate + ')');
  }

  // 2. Render certificates
  console.log('\n[2/3] 渲染证书图片...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 680, height: 960 } });
  const page = await context.newPage();

  const renderedImages = [];

  for (const w of winners) {
    console.log('  渲染: ' + w.certParams.title + ' - ' + w.orgName);
    try {
      const dataUrl = await renderCertificate(page, w.certParams);
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

  const pushGroups = {};
  for (const item of renderedImages) {
    const url = item.winner.webhookUrl;
    if (!pushGroups[url]) pushGroups[url] = [];
    pushGroups[url].push(item);
  }

  const medalEmoji = ['🥇', '🥈', '🥉'];

  for (const [webhookUrl, items] of Object.entries(pushGroups)) {
    const bigClassName = items[0].winner.bigClassName;
    console.log('\n  推送到: ' + bigClassName);

    let md = '## 🏆 本周获奖通报\n\n';
    md += '> ' + semester + ' ' + weekdayLabel + '\n';
    md += '> 考核周期：' + weekRange.monday + ' ~ ' + weekRange.sunday + '\n\n';
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
      await pushToWechat(webhookUrl, md, items[0].imageBase64);
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
