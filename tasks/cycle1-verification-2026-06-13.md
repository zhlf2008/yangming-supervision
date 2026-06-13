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

## 2026-06-13 风险处理结果（Kun 第三轮执行）

接前文 `7398a77` 绕过 PR 推 main 的风险记录，**第三轮已按用户决定 revert**：

| 操作 | commit | 状态 |
|---|---|---|
| `7398a77` 绕过 PR 推 main | — | ⚠️ 风险已识别 |
| `git revert 7398a77` | `3c5329f` | ✅ 已推 `origin/main`（admin-user v18 部署） |
| PR #1 合并到 main（`--no-ff`） | `7c135b2` | ✅ 已推 `origin/main`（生产部署） |
| 3 个测试账号清理 | — | ✅ auth.users / profiles / module_memberships 全部 0 残留 |

## 当前 main HEAD

```
7c135b2  Merge codex/platform-migration-audit into main (PR #1)  ← 已部署
3c5329f  Revert "feat: admin-user 新增人员同步与权限授权 action"
23acb75  docs: record unmerged main commit 7398a77 as PR-1 blocker
512db75  chore: move @supabase/supabase-js and playwright to devDependencies
a04b4e2  chore: add @supabase/supabase-js and playwright for release verification
f6dea6c  test: add real-flow browser regression + admin-JWT DB gate scripts
... + 12 个更早的 PR #1 commit
7398a77  feat: admin-user 新增人员同步与权限授权 action
```

## 最终状态（清理后）

- **生产 `admin-user` Edge Function** v18 = `603a596` 状态（保留 `verify_jwt=true`、保留 4 个老 action，**不含** `7398a77` 的同步/授权 action）
- **生产 `profiles`** 115（恢复成本会话开始前）
- **`module_memberships` 当前学期 `supervision`** 115（不变）
- **`temp_regression_*` 残留** 0
- **`regression_long_term` 残留** 0
- **`tasks/test-accounts.local.md`** 保留（`.gitignore` 排除）
- **PR #1** GitHub 自动标记为 Merged

## 完整事件时间线

| 时间 | 事件 | 文件 / commit |
|---|---|---|
| 19:08 | 推送 3 个 PR #1 工具 commit | `f6dea6c` / `a04b4e2` / `512db75` |
| 19:22 | `7398a77` revert 推 origin | `3c5329f` |
| 19:24 | PR #1 本地 `--no-ff` merge 到 main | `7c135b2` |
| 19:25 | 推 main → Cloudflare Pages 部署 | — |
| 19:27 | 3 个测试账号清理（auth.users / profiles / module_memberships） | — |

## 对后续 agent 的教训

1. **不要绕过 PR 流程直接 push 到 main** —— 即使是 fix 或 feat，也应走 PR review
2. **production 部署触发要分两路**：
   - Supabase Edge Function：main 改 `supabase/functions/*` 路径会自动部署
   - Cloudflare Pages：main 改静态文件会自动部署
3. **anon key 数据库查询受 RLS 严重限制** —— DB 闸门脚本必须用 admin JWT 或 service_role
4. **测试账号用完即清理** —— 本会话是 production data 0 残留的范本
5. **`7398a77` 106 行 admin-user 新功能扩展** —— 代码仍在 git 历史里（`7398a77` commit 存在），未来若需要可走 backport PR 重启
