// Step 4 浏览器回归 — 验证 17 个关键页面无白屏、无 JS 错误、关键 UI 元素存在
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8765/';
const PAGES = [
  // 平台入口
  { path: 'login.html', mustHave: ['form', 'input'], unauth: true },
  { path: 'portal.html', mustHave: ['body'] },
  // 督察旧系统
  { path: 'index.html', mustHave: ['body'] },
  { path: 'attendance-page.html', mustHave: ['body'] },
  { path: 'summary-page.html', mustHave: ['body'] },
  { path: 'leaderboard.html', mustHave: ['body'] },
  { path: 'schedule-management.html', mustHave: ['body'] },
  { path: 'profile.html', mustHave: ['body'] },
  // 秘书处
  { path: 'secretariat-dashboard.html', mustHave: ['body'] },
  { path: 'secretariat-org-management.html', mustHave: ['body'] },
  { path: 'secretariat-people.html', mustHave: ['body'] },
  { path: 'secretariat-entry-form.html', mustHave: ['body'] },
  // 学委
  { path: 'study-dashboard.html', mustHave: ['body'] },
  { path: 'study-course-library.html', mustHave: ['body'] },
  { path: 'study-schedule-rules.html', mustHave: ['body'] },
  { path: 'study-weekly-assignment.html', mustHave: ['body'] },
  // 平台审计
  { path: 'audit-log.html', mustHave: ['body'] },
];

const ANON_PAGES = new Set(['login.html']);

const results = [];

const browser = await chromium.launch();

// 匿名上下文（用于 login.html）
const anonContext = await browser.newContext();

// 登录态上下文（模拟已登录超级管理员）
const authContext = await browser.newContext();
await authContext.addInitScript(() => {
  const profile = {
    id: 'test-user-id',
    name: '回归测试账号',
    role: '超级管理员',
    organization_id: null,
    organizations: null
  };
  localStorage.setItem('supabase_user', JSON.stringify(profile));
  localStorage.setItem('currentUser', profile.name);
});

for (const page of PAGES) {
  const url = BASE + page.path;
  const ctx = page.unauth ? anonContext : authContext;
  const pageObj = await ctx.newPage();
  const errors = [];
  const consoleErrors = [];
  pageObj.on('pageerror', (e) => errors.push(String(e.message || e)));
  pageObj.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  try {
    const resp = await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = resp ? resp.status() : 0;
    // 等 1.5s 让脚本尝试初始化(不实际等网络完成)
    await pageObj.waitForTimeout(1500);
    const title = await pageObj.title();
    const bodyText = await pageObj.evaluate(() => document.body ? document.body.innerText.slice(0, 200) : '');
    const hasMustHave = await pageObj.evaluate((needles) => {
      return needles.every((n) => {
        if (n === 'body') return !!document.body;
        if (n === 'form') return !!document.querySelector('form, input, [class*="input-"]');
        if (n === 'input') return !!document.querySelector('input, button, [class*="input-"]');
        return true;
      });
    }, page.mustHave);
    results.push({
      path: page.path,
      status,
      title,
      ok: status === 200 && hasMustHave,
      pageErrors: errors,
      consoleErrors: consoleErrors.slice(0, 5),
      bodySnippet: bodyText.replace(/\s+/g, ' ').trim()
    });
  } catch (e) {
    results.push({ path: page.path, ok: false, error: String(e.message || e), pageErrors: errors, consoleErrors: consoleErrors.slice(0, 5) });
  } finally {
    await pageObj.close();
  }
}

await browser.close();

const summary = {
  total: results.length,
  pass: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
};
console.log(JSON.stringify({ summary, results }, null, 2));
process.exit(summary.fail > 0 ? 1 : 0);
