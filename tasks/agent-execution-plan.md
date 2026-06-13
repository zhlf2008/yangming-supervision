# 后续 Agent 执行计划

> 生成日期：2026-06-13  
> 项目：阳明心学班级管理平台 / 督察管理系统升级  
> 目标：让后续 agent 能按风险顺序继续审查、修复、验证，并判断是否可以安全发布。

## 1. 当前总体状态

规划文档中的 Phase 0-6、Phase 8 已基本完成：

- Phase 0：产品口径与文档
- Phase 1：导航和页面归属
- Phase 2：当前学期机制、module_memberships 学期化、effective_at
- Phase 3：秘书处成为组织和人员中心
- Phase 4：课程内容库管理员化
- Phase 5：操作日志平台化
- Phase 6：学委模块按新边界整理
- Phase 8：进班表单

主要未完成工作：

- Phase 7：督察旧系统逐步迁移
- 发布前完整回归验证
- 未跟踪 SQL / 新页面纳入版本控制并确认是否都已执行
- 大范围改动拆分、提交、推送策略确认

当前本地已通过的验证：

- `npm run lint` 多次通过，最近一次为 0 错误 0 警告
- `git diff --check -- schedule-management.html` 通过
- 多次 Supabase 只读查询确认当前学期、人员归属、督察记录关系基本正常

## 2. 当前高风险点

### 2.1 不建议直接推送 main

当前工作区改动很大，包括：

- 31 个已跟踪文件修改
- 多个未跟踪 SQL 迁移文件
- 新页面 `secretariat-entry-form.html`
- 新脚本 `js/datepicker.js`
- `supabase/migrations/` 未跟踪目录

这类状态直接推送 `main` 风险较高。必须先完成：

1. 确认未跟踪文件是否都应纳入提交。
2. 确认数据库迁移是否已在 Supabase 执行。
3. 完成督察主链路浏览器回归。
4. 拆分提交或至少创建保护分支。
5. 推送到新分支，避免直接覆盖线上主分支。

### 2.2 督察旧系统仍在迁移中

已修复/审查过的督察主链路：

- `index.html`
- `attendance-page.html`
- `summary-page.html`
- `leaderboard.html`
- `schedule-management.html`
- `profile.html`
- `reminder-settings.html`
- `semester-settings.html`
- `org-management.html` 已重定向到秘书处组织管理

仍需继续审查的督察相关页面：

- `assessment-management.html`
- `data-management.html`
- `my-records.html`
- `certificate-render.html`
- `js/components.js` 中的导航/入口组件
- `js/utils.js` 中权限、当前学期、日志、兼容逻辑

## 3. 下一个 Agent 执行顺序

### Step 1：建立只读基线

执行：

```powershell
git status --short
git diff --name-only
npm run lint
```

目标：

- 记录当前改动范围。
- 不要回滚任何已有修改。
- 不要直接提交或推送。

验收：

- lint 为 0 错误 0 警告。
- 明确哪些文件是已跟踪修改，哪些是未跟踪新增。

### Step 2：审查未跟踪文件

重点查看：

```text
js/datepicker.js
secretariat-entry-form.html
supabase/fix/20260613_001_migrate_profiles_to_people_assignments.sql
supabase/migrations/
supabase/schema/20260607_001_module_memberships_semester_id.sql
supabase/schema/20260608_001_semesters_effective_at.sql
supabase/schema/20260609_001_audit_logs_platform.sql
supabase/schema/20260610_001_entry_forms.sql
supabase/schema/20260610_002_entry_forms_v2.sql
supabase/schema/20260610_003_entry_forms_phone.sql
```

目标：

- 判断是否全部属于本次平台升级。
- 核对迁移文件是否已经写入 `supabase/MIGRATIONS.md`。
- 核对哪些 SQL 已执行，哪些只是待执行脚本。

验收：

- 形成“应提交文件清单”和“不应提交文件清单”。
- 如果不确定，不要删除，先保留并报告。

### Step 3：督察 Phase 7 剩余页面审查

逐页检查：

1. `assessment-management.html`
2. `data-management.html`
3. `my-records.html`
4. `certificate-render.html`
5. `js/components.js`
6. `js/utils.js`

检查项：

- 是否还用 `profiles.organization_id` 作为唯一组织来源。
- 是否应优先读取当前学期 `person_org_assignments`。
- 是否所有业务查询都绑定当前 `semester_id`。
- 是否普通用户可以误操作历史学期数据。
- 是否页面入口受 `guardSupervisionAccess()` 或合适权限函数保护。
- 是否有写入操作缺少组织范围校验。

验收：

- 每页给出结论：已安全 / 需修复 / 暂不改但记录风险。
- 修复后运行 `npm run lint`。

### Step 4：浏览器回归

用本地静态服务器打开页面，至少验证：

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

重点场景：

- 管理员登录后能看到平台管理区。
- 普通督察成员只能看到当前学期督察入口。
- 当前学期无权限账号被拦截。
- 人员管理能看到组织下拉和人员列表。
- 督察填报能按当前学期组织归属展示。
- 汇总和榜单只统计当前学期。
- 日程自动生成不会删除已有填报记录的日程。

验收：

- 页面无白屏。
- 控制台无阻断性 JS 错误。
- 关键数据能加载。
- 写入型动作在测试账号/测试数据下验证，不要破坏真实数据。

### Step 5：数据库发布闸门

只读核对：

- 当前 Supabase 是否已有迁移字段。
- 当前学期是否唯一。
- `people` 与 `profiles.phone` 是否已同步。
- 当前学期 `person_org_assignments` 是否覆盖主要登录账号。
- `module_memberships.semester_id` 是否有当前学期数据。

建议查询方向：

```sql
select id, semester_name, is_current, effective_at from semesters order by id;
select count(*) from people;
select count(*) from person_org_assignments where status = 'active';
select count(*) from module_memberships where enabled = true;
select count(*) from schedules where semester_id is null;
select count(*) from attendance_records ar left join schedules s on s.id = ar.schedule_id where s.id is null;
```

验收：

- 没有多个 `is_current = true` 的学期。
- 督察主数据无明显孤儿记录。
- 迁移脚本状态与文档一致。

### Step 6：提交策略

不要直接在 `main` 上推送大包。建议：

1. 从当前工作区创建分支：

```powershell
git switch -c codex/platform-migration-audit
```

2. 分批提交：

```text
commit 1: docs and migration records
commit 2: shared utils/components/navigation
commit 3: secretariat module
commit 4: study module
commit 5: supervision compatibility fixes
commit 6: entry form and datepicker
commit 7: supabase schema/fix scripts
```

3. 推送新分支：

```powershell
git push -u origin codex/platform-migration-audit
```

4. 通过 PR 或人工 diff 审查后再合并。

## 4. 是否影响当前督察系统运行

当前本地代码目标是兼容旧督察，但因为改动涉及登录、入口、权限、当前学期、组织归属、日程、汇总、榜单，属于运行链路核心改动。

若直接发布到线上，潜在影响包括：

- 登录后入口变化。
- 无当前学期 module 权限的旧账号可能被拦截。
- 督察数据按当前学期过滤后，历史数据不会再混入当前统计。
- 组织归属从旧字段切到当前学期归属后，未迁移账号会显示无归属。
- 日程生成逻辑会保留已有填报记录，不再强删旧日程。

因此发布前必须完成浏览器回归和数据库覆盖率核对。

## 5. 推荐结论

当前状态：可以继续开发和验证，不建议直接推送 main。

推荐动作：

1. 先创建新分支。
2. 完成 Phase 7 剩余页面审查。
3. 完成浏览器回归。
4. 分批提交。
5. 推送到远程新分支。
6. 线上部署前先确认数据库迁移状态。

