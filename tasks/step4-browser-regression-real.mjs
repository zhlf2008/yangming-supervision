// Step 4 浏览器回归（真实流程版）：在浏览器内调用 login.html 真实登录流程
// 关键修复：不在 addInitScript 预填 localStorage session，让 supabase-js 走完整
//   signInWithPassword → 写入 session → 后续请求自动 attach JWT
// 这样 module_memberships 的 RLS（auth.uid() = user_id）才会放行
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8765/';

const ACCOUNTS = [
  { label: 'supervision', phone: '15888396623', password: '19871125' },
  { label: 'secretariat', phone: '19900000001', password: '000001' },
  { label: 'study',       phone: '19900000002', password: '000002' },
  { label: 'no_perm',     phone: '19900000003', password: '000003' }
];

const PAGES = {
  supervision: [
    'index.html', 'attendance-page.html', 'summary-page.html',
    'leaderboard.html', 'schedule-management.html', 'profile.html'
  ],
  secretariat: [
    'secretariat-dashboard.html', 'secretariat-org-management.html',
    'secretariat-people.html', 'secretariat-entry-form.html'
  ],
  study: [
    'study-dashboard.html', 'study-course-library.html',
    'study-schedule-rules.html', 'study-weekly-assignment.html'
  ],
  no_perm: ['portal.html']
};

async function loginInPage(page, phone, password) {
  await page.goto(BASE + 'login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone', { timeout: 10000 });
  await page.fill('#phone', phone);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"], button:has-text("登"), button:has-text("登录")')
  ]);
  await page.waitForTimeout(2500);
  return page.url();
}

const results = [];
const browser = await chromium.launch();
try {
  for (const acct of ACCOUNTS) {
    const ctx = await browser.newContext();
    const loginPage = await ctx.newPage();
    let loginUrl = '';
    let loginError = null;
    try {
      loginUrl = await loginInPage(loginPage, acct.phone, acct.password);
    } catch (e) {
      loginError = String(e.message || e);
    }
    await loginPage.close();

    for (const path of PAGES[acct.label] || []) {
      const page = await ctx.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const interceptedAuth = [];
      page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('request', (req) => {
        const h = req.headers();
        if (req.url().includes('module_memberships') && h.authorization) {
          interceptedAuth.push({ url: req.url(), authorization: h.authorization.slice(0, 40) + '...' });
        }
      });
      try {
        const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const status = resp ? resp.status() : 0;
        await page.waitForTimeout(3000);
        const title = await page.title();
        const finalUrl = page.url();
        const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 250) : '');
        const gotModulePerm = await page.evaluate(() => {
          // 检查是否被 guardModuleAccess 拦截（toast 文案）
          return !document.body.innerText.includes('当前学期暂无');
        });
        results.push({
          account: acct.label, path, status, title, finalUrl, pageErrors, consoleErrors: consoleErrors.slice(0, 3),
          bodySnippet: bodyText.replace(/\s+/g, ' ').trim(),
          interceptedAuthSample: interceptedAuth[0],
          gotModulePerm,
          ok: status === 200 && pageErrors.length === 0
        });
      } catch (e) {
        results.push({ account: acct.label, path, ok: false, error: String(e.message || e) });
      } finally {
        await page.close();
      }
    }
    results.push({ account: acct.label, phase: 'login', loginUrl, loginError });
    await ctx.close();
  }
} finally {
  await browser.close();
}

const summary = {
  total: results.filter(r => r.path).length,
  pass: results.filter(r => r.ok).length,
  fail: results.filter(r => r.path && !r.ok).length,
  loginOk: results.filter(r => r.phase === 'login' && !r.loginError).length,
  loginFail: results.filter(r => r.phase === 'login' && r.loginError).length
};
console.log(JSON.stringify({ summary, results }, null, 2));
process.exit(summary.fail > 0 || summary.loginFail > 0 ? 1 : 0);
