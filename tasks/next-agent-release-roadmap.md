# 后续 Agent 发布与迭代路线图

> 生成日期：2026-06-13
> 关联 PR：<https://github.com/zhlf2008/yangming-supervision/pull/1>
> 当前分支：`codex/platform-migration-audit`

## 0. 当前结论

当前 PR 已经完成主要代码迁移、发布闸门修复和真实账号权限回归的一部分，但还不建议直接合并上线。

2026-06-14 复核补充：

- 已使用 Supabase 管理 SQL 重新复核生产库，确认 `people=116`、`person_org_assignments active=108`、`module_memberships enabled=115`、当前学期 `supervision=115`、`temp_regression_left=0`。
- 旧报告中 `people/module_memberships=0` 来自 anon key + RLS 视角，不应作为生产数据迁移失败的最终判断。
- 数据库核心闸门当前视角下已基本通过；剩余发布阻塞主要是长期测试账号和真实浏览器 17 页回归。

原因：

- 已完成真实 Supabase Auth 登录验证，但 Browser 环境禁止访问本地 `localhost/127.0.0.1/file://`，未完成真实浏览器视觉回归。
- 当前生产库当前学期没有普通 `secretariat` / `study` 模块账号，所以已通过“临时加权再回滚”的方式验证权限链路，但还缺长期测试账号。
- 当前没有安全的“无当前学期权限”测试账号，不能拿真实业务账号断权测试拦截。
- Supabase 连接器在最后一次复核时触发用量限制；临时权限删除语句已返回删除记录，但建议下一位 agent 重新做一次只读复核。

因此：先保持 PR Draft，不要合并 main，不要部署生产。

## 1. 已完成回归记录

### 1.1 普通督察真实账号回归

已用两个普通督察账号按以下规则真实登录：

```text
账号 = 手机号
密码 = 手机号后 6 位
```

结果：

- 登录成功。
- 可读取 `profiles`。
- 当前学期识别为 `阳明心学第14期`。
- 当前学期 `module_memberships` 包含 `supervision`。
- 当前学期 `person_org_assignments` active 归属存在。
- 当前学期组织归属与旧 `profiles.organization_id` 一致。

### 1.2 临时秘书处 / 学委权限回归

为避免创建真实长期账号，本轮临时插入两条权限：

```text
id=115, module_key=secretariat, role=temp_regression_secretariat
id=116, module_key=study, role=temp_regression_study
```

验证结果：

- 临时秘书处账号真实登录后可读取 `secretariat` 权限。
- 临时学委账号真实登录后可读取 `study` 权限。
- 两个账号均可读取当前学期、组织、人员、学委日程规则等核心只读数据。

回滚：

```sql
delete from module_memberships
where id in (115, 116)
  and role in ('temp_regression_secretariat', 'temp_regression_study')
returning id, user_id, module_key, role, org_id;
```

Supabase 返回两条删除记录，说明临时权限已按语句删除。

下一位 agent 必须重新只读确认：

```sql
select module_key, count(*) as count
from module_memberships mm
join semesters s on s.id = mm.semester_id and s.is_current = 1
where mm.enabled = true
group by module_key
order by module_key;

select count(*) as temp_left
from module_memberships
where role in ('temp_regression_secretariat', 'temp_regression_study');
```

期望：

```text
module_key = supervision, count = 114
temp_left = 0
```

## 2. Release Cycle 1：合并前发布闸门

目标：确认 PR #1 可以从 Draft 转 Ready。

执行步骤：

1. 拉取最新分支：

```powershell
git fetch origin
git switch codex/platform-migration-audit
git pull --ff-only
```

2. 本地验证：

```powershell
npm run lint
git diff --check main..HEAD
git status --short --branch
```

验收：

- lint 0 错误 0 警告。
- diff check 无输出。
- 工作区干净。

3. Supabase 只读复核：

```sql
select count(*) from semesters where is_current = 1;
select count(*) from people;
select count(*) from person_org_assignments where status = 'active';
select module_key, count(*) from module_memberships where enabled = true group by module_key;
select count(*) from schedules where semester_id is null;
select count(*)
from attendance_records ar
left join schedules s on s.id = ar.schedule_id
where s.id is null;
```

验收：

- 当前学期唯一。
- `people`、`person_org_assignments`、`module_memberships` 非空。
- 没有无学期日程。
- 没有孤儿考勤。
- 没有残留 `temp_regression_*` 权限。

4. 创建或指定长期测试账号：

至少准备：

- 一个普通秘书处账号。
- 一个普通学委账号。
- 一个无当前学期权限账号。

不要用真实业务账号断权做无权限测试。

5. 真实浏览器回归：

在能访问本地或部署预览的浏览器中测试：

```text
login.html
portal.html
index.html
attendance-page.html
summary-page.html
leaderboard.html
schedule-management.html
profile.html
secretariat-dashboard.html
secretariat-org-management.html
secretariat-people.html
secretariat-entry-form.html
study-dashboard.html
study-course-library.html
study-schedule-rules.html
study-weekly-assignment.html
audit-log.html
```

验收：

- 无白屏。
- 控制台无阻断性 JS error。
- 普通督察能进入督察模块。
- 普通秘书处能进入秘书处模块。
- 普通学委能进入学委模块。
- 无当前学期权限账号被拦截。
- 管理员可以看到平台管理入口。

通过后：

- 在 PR 留言记录结果。
- 将 PR 从 Draft 转 Ready。

## 3. Release Cycle 2：上线执行

目标：合并 PR 并完成生产验证。

执行前确认：

- 是否自动部署静态页面。
- Supabase migrations 是否自动执行。
- `20260613_001_migrate_profiles_to_people_assignments.sql` 是数据迁移脚本，目前不在 Supabase migration history 中；新环境必须单独确认执行方式。

上线步骤：

1. 合并 PR #1 到 `main`。
2. 等待部署完成。
3. 打开线上地址验证登录页。
4. 用真实普通督察账号登录。
5. 用秘书处 / 学委测试账号登录。
6. 用无权限测试账号登录。
7. 验证督察首页、填报、汇总、榜单、个人页。
8. 验证秘书处组织和人员页面。
9. 验证学委规则和每周安排页面。

上线后 30 分钟观察：

- 登录失败数量。
- Supabase Auth 错误。
- 页面控制台错误。
- 用户反馈：无权限、无组织、无人员、统计为空。

回滚策略：

- 如果是前端静态部署问题，回滚到上一版 main。
- 如果是权限数据问题，不要回滚代码，先修 `module_memberships` / `person_org_assignments` 数据。
- 如果是当前学期判断错误，先确认 `semesters.is_current` 和 `effective_at`。

## 4. Release Cycle 3：上线后一周稳定化

目标：处理真实用户反馈，减少人工排查成本。

任务：

1. 增加一个只读“我的当前权限”诊断页或调试函数，展示：
   - 当前 profile。
   - 当前学期。
   - 当前学期 module 权限。
   - 当前学期组织归属。

2. 在登录失败和无权限提示中加入更明确文案：
   - 当前学期名称。
   - 用户手机号后四位。
   - 建议联系秘书处或管理员。

3. 给秘书处人员页增加异常筛选：
   - 有账号但无人员档案。
   - 有人员档案但无当前学期归属。
   - 有归属但无模块权限。
   - 有模块权限但无组织范围。

4. 审查 `audit_logs` 写入点：
   - 是否带 `module_key`。
   - 是否带 `semester_id`。
   - 操作人是否可追溯。

验收：

- 管理员能快速定位“为什么某人进不了系统”。
- 秘书处能看到待修复人员数据。
- 常见无权限问题不需要查 SQL。

## 5. Release Cycle 4：数据库与迁移规范整理

目标：消除 schema/migrations 双轨混乱。

任务：

1. 明确唯一发布来源：

```text
supabase/migrations/
```

2. 将 `supabase/schema/20260607~20260610` 标注为历史镜像或归档。

3. 将 `20260613_001_migrate_profiles_to_people_assignments.sql` 转成正式、可审计的数据迁移方案：
   - 如果只允许生产执行一次，写进 `supabase/fix/` 并在 `MIGRATIONS.md` 标注“手动数据迁移”。
   - 如果要所有环境自动执行，迁入 `supabase/migrations/`，并设计幂等逻辑。

4. 给 `module_memberships.id` 增加明确的序列或 identity 策略，避免后续手写 id。

5. 给关键表补唯一约束和索引审查：
   - `people(phone)`
   - `person_org_assignments(semester_id, person_id, org_id, status)`
   - `module_memberships(user_id, semester_id, module_key, role, org_id)`

验收：

- 新环境可以从 migrations 建库。
- 不再需要猜哪些 schema 文件要执行。
- 后续 agent 不再手写 `module_memberships.id`。

## 6. Release Cycle 5：督察 Phase 7 深化

目标：彻底降低旧字段依赖。

任务：

1. 全局扫描：

```powershell
rg -n "organization_id|profiles\\.role|currentUser\\.role|currentUser\\.organization_id" *.html js
```

2. 分类每个命中：
   - 兼容兜底，可保留。
   - 真实业务读取，应迁移。
   - 废弃页面，可重定向或删除入口。

3. 重点页面：
   - `assessment-management.html`
   - `data-management.html`
   - `my-records.html`
   - `certificate-render.html`
   - `js/components.js`
   - `js/utils.js`

4. 所有督察查询确认：
   - 是否带当前 `semester_id`。
   - 是否带当前组织范围。
   - 是否不会跨学期读取历史数据。

验收：

- 旧字段只作为 fallback。
- 当前学期切换后，督察入口、统计、填报、榜单同步切换。
- 无当前学期权限无法进入督察。

## 7. Release Cycle 6：秘书处与学委产品补齐

目标：让新模块不仅能进，还能真正运营。

秘书处：

- 人员导入 / 批量分组。
- 人员转组 / 离班 / 复学。
- 职务管理。
- 模块权限批量配置。
- 当前学期人员完整性检查。

学委：

- 日程规则到日程实例生成。
- 周计划复制与调整。
- 大班 / 班级 / 小组三级摊派。
- 小组最终落人。
- 通知文案生成。

验收：

- 秘书处可以独立维护一学期组织人员。
- 学委可以独立完成一周排班闭环。
- 督察、学委都消费同一套人员和组织数据。

## 8. 给下一位 Agent 的硬性要求

- 不要直接合并 PR。
- 不要拿真实业务账号做断权测试。
- 不要删除旧字段 `profiles.role`、`profiles.organization_id`。
- 不要把 `schema/` 和 `migrations/` 同时作为执行来源。
- 每个阶段结束都要：
  - 跑 `npm run lint`。
  - 跑 `git diff --check main..HEAD`。
  - 在 PR 留言记录验证结果。
  - 明确是否可以进入下一阶段。

## 9. 2026-06-14 latest handoff update

Use `tasks/release-next-steps-runbook.md` as the current source of truth for
the next execution pass.

New completed item:

- `admin-user` Edge Function was found to be deployed without server-side caller
  authorization. It has now been fixed, deployed, and verified.
- Commit: `603a596 fix: require auth for admin user function`.
- Supabase project: `whvjfurrkusdwujjodwc`.
- Deployed function: `admin-user`, version `16`, `verify_jwt=true`.
- Verification:
  - no Authorization header returns 401.
  - publishable/anon-key-only request returns 401.
  - `npm.cmd run lint` passed.
  - `node --check supabase/functions/admin-user/index.ts` passed.
  - `git diff --check` passed.

Current blocking items:

1. Prepare or confirm long-term test accounts:
   - current-semester `secretariat` account.
   - current-semester `study` account.
   - no-current-semester account.
2. Do not use real business accounts for permission-removal testing.
3. Complete manual Chrome Preview regression using
   `tasks/manual-preview-regression-checklist.md`.
4. Record the result in PR #1.
5. Move PR #1 from Draft to Ready only if all gates pass.

Known read-only inventory as of 2026-06-14:

- current semester: `阳明心学第14期` (`id=4`).
- current enabled memberships are `supervision` only, total `115`.
- active Auth users without current-semester membership: `0`.
- no long-term `secretariat` or `study` test membership exists yet.

Decision:

- Keep PR #1 as Draft until `tasks/release-next-steps-runbook.md` Steps 1-5
  are complete.
