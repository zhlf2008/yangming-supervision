## Cycle 1 复核报告(2026-06-13,后续 agent 接力)

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
