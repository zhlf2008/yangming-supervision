# 会话快照：2026-06-10

> 保存用于新会话快速恢复。

## 项目定位

阳明心学班级管理平台。原为单一督察管理系统，已扩展为多模块平台：
**平台 portal → 督察 / 秘书处 / 学委**

---

## 当前进度（按规划 Phase）

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 文档与产品口径 | ✅ |
| 1 | 导航和页面归属修正 | ✅ |
| 2 | module_memberships 加 semester_id + effective_at 自动学期切换 | ✅ |
| 3 | 秘书处权限拦截 + 页面图标化 | ✅ |
| 4 | 课程内容库权限落地（RLC + 前端按钮隐藏） | ✅ |
| 5 | 操作日志平台化（audit-log 重写, 模块/学期/操作人筛选） | ✅ |
| 6 | 学委页面权限拦截 + 图标化 | ✅ |
| 7 | 督察旧系统逐步迁移 | ⬜ 未做 |

### 新增功能（不在规划 Phase 中）
- **进班表单**（secretariat-entry-form.html）：11 项学员入学信息采集，366 城市 + 2919 区县三级联动，农历/阳历双历日期选择器，拼音排序
- **门户全局权限分流**：login.html 按当前学期 module_memberships 决定入口（0 模块 → 无权限提示，1 模块 → 直达，多模块 → portal）
- **portal 动态入口**：按当前学期权限动态显示/隐藏模块卡片
- **智能返回**：`?from=portal` 参数控制子页面返回路径

---

## 本轮改动总览（15 个文件）

| 文件 | 改动内容 |
|------|---------|
| `index.html` | 移除操作日志入口；所有用户可见"切换模块"按钮 |
| `portal.html` | **重写**：图标网格布局 → 学期大容器 + 平台管理专区 + 按权限动态显示 |
| `login.html` | **重写分流逻辑**：查 module_memberships 决定入口 |
| `secretariat-dashboard.html` | **重写**：3 列图标网格 + 进班表单入口 |
| `study-dashboard.html` | **重写**：2×2 图标网格 + 管理员可编辑提示 |
| `secretariat-org-management.html` | 加 `guardModuleAccess('secretariat')` |
| `secretariat-people.html` | 加权限拦截 + 权限加载/新增时带 semester_id |
| `secretariat-semesters.html` | 加权限拦截 + 智能返回 from 参数 |
| `study-schedule-rules.html` | 加 `guardModuleAccess('study')` + logAction 传入 moduleKey |
| `study-weekly-assignment.html` | 加 `guardModuleAccess('study')` |
| `study-course-library.html` | 加权限拦截 + 非管理员隐藏编辑按钮 + logAction 传入 moduleKey |
| `study-course-detail.html` | 加权限拦截 + 非管理员隐藏所有操作按钮 + logAction 传入 moduleKey |
| `audit-log.html` | **重写**：平台审计页(模块/学期/操作人/类型筛选 + 分页) |
| `js/utils.js` | **3 个新函数**：guardModuleAccess、autoSwitchSemester、logAction 升级 |
| **新增** `secretariat-entry-form.html` | 完整进班表单 |

---

## 新增数据库迁移

| 序号 | 文件 | 说明 |
|------|------|------|
| 021 | `20260607_001_module_memberships_semester_id.sql` | module_memberships 加 semester_id |
| 022 | `20260608_001_semesters_effective_at.sql` | semesters 加 effective_at |
| 023 | `20260609_001_audit_logs_platform.sql` | audit_logs 加 module_key/semester_id |
| 024 | `20260610_001_entry_forms.sql` | 进班表单表 |
| 025 | `20260610_002_entry_forms_v2.sql` | 字段优化 v2 |
| 026 | `20260610_003_entry_forms_phone.sql` | phone 字段 |
| fix | `20260608_001_fix_study_courses_rls.sql` | 课程合集 RLS 修复 |

---

## 新架构决策

1. **guardModuleAccess(moduleKey)** — 通用权限拦截：管理员直接放行，普通用户查当前学期 module_memberships，无权限 toast 提示后跳 portal
2. **autoSwitchSemester()** — getCurrentSemesterId 自动调用，检查 effective_at 到期学期自动切换 is_current
3. **logAction 升级** — 第 4 参 moduleKey，自动补充 semester_id，支持平台化审计筛选
4. **省份硬编码** — 进班表单使用 34 省静态选项（不用查询）
5. **拼音排序** — PINYIN_FIRST 字典 + pySort 函数，省市区均按拼音排列
6. **智能返回** — `?from=portal` 参数使子页面返回时知道原本从哪里进入

---

## 关键产品决策

- 平台管理（学期/课程库/日志）归 `portal.html` 管理专区，仅管理员可见
- 秘书处只管理当前学期的组织和人员，不管学期创建
- 学委只做排班业务，课程内容库仅管理员可编辑
- 操作日志归平台审计，不归督察模块
- portal 三个模块卡片按当前学期权限动态显示/隐藏
- 登录后按 module_memberships 数量自动分流

---

## 待执行 SQL（Supabase SQL Editor 按序执行）

1. `20260607_001_module_memberships_semester_id.sql`
2. `20260608_001_semesters_effective_at.sql`
3. `20260609_001_audit_logs_platform.sql`
4. `20260610_001_entry_forms.sql`
5. `20260610_002_entry_forms_v2.sql`
6. `20260610_003_entry_forms_phone.sql`
7. `supabase/fix/20260608_001_fix_study_courses_rls.sql`

---

## 数据模型

```
核心:
  profiles            → 登录账号
  people              → 人员档案（跨学期）
  semesters           → 学期（含 effective_at）
  module_memberships  → 模块权限（带 semester_id）

督察（旧系统，未动）:
  schedules, attendance_records, assessment_types, organizations

秘书处:
  person_org_assignments  → 学期组织归属
  person_positions        → 职务
  entry_forms             → 进班表单

学委:
  study_course_library     → 课程内容库
  study_courses            → 课程合集
  study_schedule_rules     → 日程规则
  study_schedule_instances → 日程实例
  study_assignment_demands → 岗位摊派
  study_assignment_people  → 人员落位

平台:
  audit_logs → 操作日志（含 module_key, semester_id）
```

---

## 2026-06-14 final（Kun 接力会话更新）

接 2026-06-10 快照，本会话完成所有阻塞 PR #1 的工作。

### 当前 main HEAD

```
7c135b2  Merge codex/platform-migration-audit into main (PR #1)  ← 已部署
3c5329f  Revert "feat: admin-user 新增人员同步与权限授权 action"
23acb75  docs: record unmerged main commit 7398a77 as PR-1 blocker
512db75  chore: move @supabase/supabase-js and playwright to devDependencies
a04b4e2  chore: add @supabase/supabase-js and playwright for release verification
f6dea6c  test: add real-flow browser regression + admin-JWT DB gate scripts
... + 12 个更早的 PR #1 commit
7398a77  feat: admin-user 新增人员同步与权限授权 action
bc434a3  docs: 更新平台模块化规划文档
```

### Phase 7 状态

| Phase | 内容 | 状态 |
|-------|------|------|
| 7 | 督察旧系统逐步迁移 | ✅ 完成（browser regression 15/15 + DB 闸门 12/12 指标绿） |

### 剩余工作（Cycle 2 起）

- Phase 7 之后的**新功能**：课程合集卡片视觉改版（`tasks/todo.md`）
- `supabase/` 目录整理（`tasks/organize-plan.md`：根目录 SQL 移到 `schema/`/`rls/`/`fix/`/`data/` 子目录）
- 后续 Cycle 增量功能：人员导入/批量分组、转组/离班/复学、职务管理、周计划复制与调整等（`tasks/next-agent-release-roadmap.md` Release Cycle 6-7）

### 本会话新增强化（不进入 0-7 Phase 框架）

- **admin-user Edge Function 安全加固**（commit `603a596`，已部署 v16/v18）
- **长期测试账号**（已创建并已清理，账号清单保留在 `tasks/test-accounts.local.md`）
- **真实登录流程浏览器回归**（`tasks/step4-browser-regression-real.mjs`，15/15 通过）
- **管理员 JWT 视角 DB 闸门**（`tasks/step5-db-gate-admin.mjs`，与原 anon key 版对照）
- **0 依赖静态服务器**（`tasks/dev-server.mjs`，`127.0.0.1:8765`）

### 数据闸门快照（清理后）

- 当前学期 `阳明心学第14期`（id=4）
- `profiles` 115（`profiles.organization_id` 非空 107）
- `people` 116
- `person_org_assignments` active 108
- `module_memberships` 当前学期 `supervision` 115
- `temp_regression_*` 残留 0
- `regression_long_term` 残留 0
- `schedules.semester_id is null` 0
- 孤儿考勤 0
- `audit_logs` 3326
- `entry_forms` 1

### 已部署的 admin-user 版本

- **v18**（生产当前）= `603a596 fix: require auth for admin user function` 状态
  - 保留 `createUser` / `deleteUser` / `updateUser` / `generateSchedules` 4 个老 action
  - 保留 `getCaller()` 二次校验
  - 平台层 `verify_jwt=true`
  - **不含** `7398a77` 的 `syncModuleMemberships` / `syncPeople` / `setPersonPosition` / `setPersonOrg` 4 个 action
- 历史版本参考：v17（`7398a77` 直接 push 到 main，未走 PR）已被 revert
