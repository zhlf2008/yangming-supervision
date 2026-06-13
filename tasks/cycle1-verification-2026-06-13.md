# 2026-06-13 17:30+08:00 数据库 / 浏览器闸门复核（Kun 本轮执行）

## 数据库闸门（管理员 JWT 视角）

执行：`node tasks/step5-db-gate-admin.mjs`

| 指标 | 实际 | 评估 |
|------|------|------|
| 当前学期 | `阳明心学第14期` (`id=4`, `effective_at=2026-04-27`) | ✅ 唯一 |
| `profiles` | 118 | ✅ |
| `profiles.organization_id` 非空 | 107 | ✅ |
| `people` | 116 | ✅ |
| `person_org_assignments` active | 108 | ✅ |
| `module_memberships` enabled | 117 | ✅ |
| 当前学期 `supervision` | 115 | ✅ |
| 当前学期 `secretariat` | 1 | ✅（本轮新增 `regression_long_term`） |
| 当前学期 `study` | 1 | ✅（本轮新增 `regression_long_term`） |
| 4 类测试账号权限矩阵 | 3 条期望记录全到位，无权限账号空 | ✅ |
| 临时权限残留（`temp_regression_*`） | 0 | ✅ |
| `schedules.semester_id` 空 | 0 | ✅ |
| 孤儿考勤 | 0 | ✅ |
| `entry_forms` | 1 | ✅ |
| `audit_logs` | 3326 | ✅ |

## 数据库闸门（anon key 视角，对照原版 step5-db-gate.mjs）

执行：`node tasks/step5-db-gate.mjs`

| 指标 | 实际 | 与管理员视角差异 | 原因 |
|------|------|----------------|------|
| `people` | 0 | 116 | RLS：anon key 无 `people` 读权限 |
| `person_org_assignments_active` | 0 | 108 | RLS：anon key 无 `person_org_assignments` 读权限 |
| `module_memberships_enabled` | 0 | 117 | RLS：anon key 无 `module_memberships` 读权限 |
| `temp_regression_left` | 0 | 0 | ✅ |
| `schedules_no_semester` | 0 | 0 | ✅ |
| `orphan_attendance_count` | 0 | 0 | ✅ |
| `entry_forms_count` | 0 | 1 | RLS：anon key 无 `entry_forms` 读权限 |
| `audit_logs_count` | 3326 | 3326 | ✅ 公开可读 |

**结论**：anon key 受 RLS 严重限制，**不应**作为生产数据迁移是否完成的判断依据。应使用 Supabase 管理 SQL 或 service role / 管理员 JWT 视角。

## 浏览器回归（Playwright 17 关键页）

执行：`node tasks/step4-browser-regression.mjs`（搭配 `tasks/dev-server.mjs` 在 `127.0.0.1:8765` 提供本地静态文件）

| 指标 | 实际 |
|------|------|
| 总页数 | 17 |
| 通过 | **17** |
| 失败 | 0 |
| 阻断性 page error | 0 |
| 阻断性 console error | 0 |
| 全部 HTTP 状态 | 200 |

页面分布：

- **平台入口 2**：`login.html`、`portal.html` — 正常
- **督察 6**：`index.html` / `attendance-page` / `summary-page` / `leaderboard` / `schedule-management` / `profile` — 渲染时被路由重定向到 `login.html`（脚本注入的是伪造 `currentUser`，无真实 Supabase JWT，**这是路由守卫正常工作的证据**）
- **秘书处 4**：`secretariat-dashboard` / `secretariat-org-management` / `secretariat-people` / `secretariat-entry-form` — 正常渲染真实内容
- **学委 4**：`study-dashboard` / `study-course-library` / `study-schedule-rules` / `study-weekly-assignment` — 正常渲染真实内容
- **平台 1**：`audit-log.html` — 正常渲染 3326 条日志 + 4 模块筛选

**结论**：静态前端所有 17 关键页面均无白屏、无 JS 错误、无控制台阻断性错误。注：本次为**结构回归**（mock 登录态），不是真实账号业务回归。真实 4 类账号业务回归需要走 `tasks/manual-preview-regression-checklist.md` 用 Preview URL 在真实 Chrome 浏览器中执行。

## 本轮新增/修改

| 文件 | 类型 | 用途 |
|------|------|------|
| `tasks/dev-server.mjs` | 新增 | 0 依赖静态文件服务器（`127.0.0.1:8765`） |
| `tasks/step5-db-gate-admin.mjs` | 新增 | 管理员 JWT 视角数据库闸门（与原 `step5-db-gate.mjs` 对照） |
| `tasks/test-accounts.local.md` | 新增 | 4 类长期回归账号清单（已被 `.gitignore` 排除） |
| `.gitignore` | 改 | 新增 `test-accounts.local.md` 忽略规则 |

`tasks/release-next-steps-runbook.md` 的 Step 1-4 已实质完成。下一步是真实 Chrome Preview 回归。

## 2026-06-13 风险新增（Kun 第二轮执行发现）

合并 PR #1 **之前**必须先处理 `origin/main` 上未走 PR 流程的 commit：

| Commit | 作者 | 时间 | 性质 |
|---|---|---|---|
| `7398a77 feat: admin-user 新增人员同步与权限授权 action` | `zhlf2008` via GitHub Web UI | 2026-06-14 00:27:44 +0800 | **直接 push 到 main，绕过 PR review** |

该 commit 改动 `supabase/functions/admin-user/index.ts` +106/-1，新增以下高权限 action（用 service_role 写生产数据）：

- `syncModuleMemberships` — 从 profiles 全量同步到 module_memberships（会覆盖生产）
- `syncPeople` — 从 profiles 同步到 people
- `setPersonPosition` / `setPersonOrg` — 按姓名 upsert 职务/组织
- `upsertByPersonId` — 通用 helper
- 修复中文 body 解码（`req.json()` → `TextDecoder('utf-8')`）

**违背了 `tasks/release-next-steps-runbook.md` 的硬性要求**：

> Do not publish credentials, code, or schema changes to `main` without going through the PR + review flow.

**建议**（不在本轮自动执行）：

1. 在 GitHub 上查看 `7398a77` 是否已部署到生产 `admin-user`（应该是 v17）
2. 决定是保留 / revert / 走 backport PR：
   - **保留**：把 `7398a77` 拉回到 `codex/platform-migration-audit` 的一个新 commit 里（squash 或 cherry-pick），使 PR #1 包含这个改动 → 走正常 review
   - **revert**：先 `git revert 7398a77` 在 main 上撤销，再让 PR #1 重新走流程
   - **不动**：明确该 commit 故意走 fast-path，文档化
3. 处理完后再合并 PR #1

本轮 Kun 没有执行 `git merge` / `gh pr merge` / 在 GitHub 点 Merge。所有 git 状态变化仅限 3 个 commit（`f6dea6c` / `a04b4e2` / `512db75`）已推到 `origin/codex/platform-migration-audit`。
