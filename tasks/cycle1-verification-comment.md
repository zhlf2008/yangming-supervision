## Cycle 1 复核报告(2026-06-13,后续 agent 接力)

## 2026-06-14 复核修正

上一版报告中 `people`、`person_org_assignments`、`module_memberships` 为 0 的结论，来自 `tasks/step5-db-gate.mjs` 使用 anon key 的只读查询。该脚本会受 RLS 影响，因此不适合作为生产数据是否已迁移的最终依据。

使用 Supabase 管理 SQL 对项目 `whvjfurrkusdwujjodwc` 重新只读复核后，生产库实际状态如下：

| 指标 | 实际 | 评估 |
|------|------|------|
| 当前学期唯一 | 1 | ✅ |
| `profiles` | 115 | ✅ |
| `profiles.organization_id is not null` | 107 | ✅ |
| `people` | 116 | ✅ |
| `person_org_assignments active` | 108 | ✅ |
| `module_memberships enabled` | 115 | ✅ |
| 当前学期 `supervision` 权限 | 115 | ✅ |
| `temp_regression_*` 残留 | 0 | ✅ |
| `schedules.semester_id is null` | 0 | ✅ |
| 孤儿考勤 | 0 | ✅ |
| `audit_logs` | 3326 | ✅ |

结论：数据库迁移阻塞项已解除，或至少生产库当前数据已经满足 Release Cycle 1 的核心数据闸门。后续不要再仅凭 anon key 脚本输出判断生产迁移失败；应使用 Supabase 管理 SQL 或 service role 视角复核。

仍未完成 / 仍建议保持 Draft 的事项：

1. 创建或指定 3 类长期测试账号：普通秘书处、普通学委、无当前学期权限。
2. 在能稳定访问本地或部署预览的真实浏览器环境中完成 17 页回归。
3. 将本次修正结论同步到 PR 评论后，再决定是否从 Draft 转 Ready。

### 本地验证 ✅
- `npm run lint` — 0 错误 0 警告
- `git diff --check main..HEAD` — 无输出
- `git status` — 工作区干净(只有新增的 `tasks/next-agent-release-roadmap.md`)
- 本地 main 与 origin/main 同步,无需 pull

### Supabase 只读复核 ❌(阻塞合并)

依据 [tasks/next-agent-release-roadmap.md](../blob/maincodex/platform-migration-audit/tasks/next-agent-release-roadmap.md) Release Cycle 1 第 3 步 6 条 SQL 复核,使用 [tasks/step5-db-gate.mjs](../blob/maincodex/platform-migration-audit/tasks/step5-db-gate.mjs) 跑出的实际数据:

| 指标 | 期望 | 实际 | 评估 |
|------|------|------|------|
| 当前学期唯一 | 1 | 1 (`阳明心学第14期`, `effective_at=2026-04-27`) | ✅ |
| `people` 非空 | > 0 | **0** | ❌ |
| `person_org_assignments` active | > 0 | **0** | ❌ |
| `module_memberships` enabled(总) | > 0 | **0** | ❌ |
| 当前学期 `supervision` 数 | 114 | **0** | ❌ |
| `temp_regression_*` 残留 | 0 | 0 | ✅(临时权限已回滚干净) |
| `schedules` 无学期 | 0 | 0 | ✅ |
| 孤儿考勤 | 0 | 0 | ✅ |
| `entry_forms` | - | 0 | ❌(空但表已建) |
| `audit_logs` | - | 3325 | ✅ |

### 与 PR 描述/roadmap 期望的差异

PR #1 body 描述和 roadmap 第 0 节、第 1.1 节均声称生产库当前学期存在 114 个普通督察账号、107 个 active 归属、115 个 people 记录。**实际查询结果为 0**。

可能解释:
1. PR body 和 roadmap 是基于"假如数据迁移完成后"的预期写的,生产库实际从未执行过 `20260613_001_migrate_profiles_to_people_assignments.sql`
2. 或数据迁移在 PR 期间确实执行过,但之后被回滚
3. 或 Supabase 连接器用量限制导致 roadmap 当时也未能完整复核

### 阻塞项

按 roadmap 第 8 节硬性要求"不要直接合并 PR",在以下条件未满足前**不建议合并 main、不建议部署生产**:

1. ❌ `20260613_001_migrate_profiles_to_people_assignments.sql` 必须先在 Supabase 执行
2. ❌ `module_memberships`、`people`、`person_org_assignments` 三张表必须非空
3. ❌ 当前学期 `supervision` 权限记录必须补齐(roadmap 期望 114)
4. ❌ 必须创建 3 类长期测试账号(普通秘书处 / 普通学委 / 无当前学期权限),不能用真实业务账号断权
5. ❌ 必须在能访问本地或部署预览的浏览器中完成 17 页真实账号视觉回归

### 建议下一步

下一位 agent:
1. 确认 `20260613_001` 是否在生产执行过(查 Supabase `migration history` / `audit_logs`)
2. 如未执行,手动跑该 SQL,然后重跑 `step5-db-gate.mjs`
3. 创建 3 类长期测试账号
4. 在 PR 留言记录"已具备合并条件"
5. PR 维持 Draft,本条留言后继续保持

### 验证脚本

- 浏览器回归: `node tasks/step4-browser-regression.mjs`(需本地静态服务器,17/17 通过,基于模拟超级管理员)
- 数据库复核: `node tasks/step5-db-gate.mjs`(本条留言基于此脚本输出)

## 2026-06-14 latest status correction

The earlier anon-key report that showed `people`, `person_org_assignments`, and
`module_memberships` as `0` is not the current release decision basis. It was
caused by anon-key/RLS visibility. Supabase management SQL later confirmed the
production data gate is no longer the primary blocker.

Latest confirmed state:

- production project: `whvjfurrkusdwujjodwc`
- current semester: `阳明心学第14期` (`id=4`)
- `people=116`
- active `person_org_assignments=108`
- enabled `module_memberships=115`
- current-semester `supervision=115`
- `temp_regression_left=0`
- schedules without semester: `0`
- orphan attendance records: `0`

Additional release-blocking item found and fixed:

- `admin-user` Edge Function previously allowed public calls without server-side
  caller authorization.
- Fixed in commit `603a596 fix: require auth for admin user function`.
- Deployed to Supabase as `admin-user` version `16` with `verify_jwt=true`.
- Verified no-token and publishable-key-only calls both return 401.

Still blocking PR #1 Ready:

1. create or confirm long-term current-semester `secretariat` test account.
2. create or confirm long-term current-semester `study` test account.
3. create or confirm safe no-current-semester test account.
4. complete manual Chrome Preview regression for the 17-page matrix.

Use `tasks/release-next-steps-runbook.md` for the detailed next execution plan.
