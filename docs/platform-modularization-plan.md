# 阳明心学班级管理平台模块化规划

## 1. 背景与目标

当前项目已经基本完成“督察管理”板块，现有系统以督察考勤、考核、汇总、榜单、提醒为核心。下一步需要把项目升级为“阳明心学班级管理平台”：

- 保留并稳定现有督察系统；
- 新增平台入口，用于承载多个业务模块；
- 新增学委模块，支持课程内容、学习日程、排班、通知、优秀作业等业务；
- 未来新增秘书处模块，作为人员主数据、账号、分组、职务和权限管理中心。

总体原则：

1. **一套账号，多模块身份。** 用户只登录一次，但可以在不同模块拥有不同角色。
2. **业务模块相互独立。** 督察、学委、秘书处各自拥有清晰的数据和页面边界。
3. **人员主数据统一管理。** 普通学员不一定有系统账号，但必须能被建档、分组、排班。
4. **现有督察系统低风险兼容。** 第一阶段不大规模重构已稳定的督察页面和表结构。
5. **分阶段实施。** 先保存架构和业务模型，再逐步开发平台入口、秘书处基础、学委业务。

## 2. 平台总体架构

目标结构：

```text
阳明心学班级管理平台
├─ 平台层
│  ├─ 登录
│  ├─ 模块入口
│  ├─ 平台用户基础资料
│  ├─ 多模块身份
│  └─ 操作日志
├─ 秘书处模块
│  ├─ 信息收集表
│  ├─ 人员建档
│  ├─ 分班分组
│  ├─ 职务管理
│  ├─ 系统账号开通
│  └─ 模块权限分配
├─ 督察模块
│  ├─ 考勤填报
│  ├─ 考核项目管理
│  ├─ 日程管理
│  ├─ 数据汇总
│  ├─ 榜单证书
│  └─ 企业微信提醒
└─ 学委模块
   ├─ 课程内容库
   ├─ 学期日程规则
   ├─ 周计划
   ├─ 大班/班级/小组共读日程
   ├─ 岗位摊派
   ├─ 小组最终落人
   ├─ 一周排班表
   ├─ 通知文案
   ├─ 企业微信推送
   └─ 优秀作业展示
```

## 3. 一套账号与多模块身份

账号共享不是共享角色，而是共享登录身份。

- `auth.users`：Supabase Auth 登录账号，只负责“这个人能不能登录”。
- `profiles`：当前项目已有用户资料表，第一阶段继续保留，作为兼容的人员基础资料。
- `module_memberships`：新增模块身份表，负责“这个人在某个模块里是什么身份，归属哪个组织”。

示例：

```text
张三
├─ 督察模块：小组督察 / 致良组
└─ 学委模块：班级学委 / 三班
```

推荐 `module_memberships` 字段：

```text
id
user_id             -- auth.users.id / profiles.id
person_id           -- 后续可关联秘书处人员档案
module_key          -- supervision / study / secretariat
role                -- 小组督察 / 班级学委 / 秘书处管理员等
org_id              -- 对应模块身份所属组织
enabled
created_at
updated_at
```

登录后判断逻辑：

1. 用户登录 Supabase Auth；
2. 读取用户基础资料；
3. 读取 `module_memberships`；
4. 根据身份决定进入哪个模块或是否显示模块入口。

## 4. 老督察系统兼容策略

现有督察账号不废弃、不重建、不改密码。

第一阶段保留：

```text
profiles.role
profiles.organization_id
```

现有督察页面继续按旧逻辑运行。

新增 `module_memberships` 后，把老督察账号迁移为“督察模块身份”：

```sql
insert into module_memberships (user_id, module_key, role, org_id, enabled)
select
  id,
  'supervision',
  role,
  organization_id,
  true
from profiles
where role is not null
on conflict do nothing;
```

入口分流第一阶段策略：

```text
超级管理员 / 管理员
  → portal.html
  → 可选择督察 / 学委 / 后续秘书处

普通老督察角色
  → 直接进入现有督察首页 index.html
  → 不显示督察/学委选择菜单
```

后续 `module_memberships` 稳定后，再升级为：

```text
只有一个模块身份 → 自动进入该模块
多个模块身份 → 进入 portal.html 选择模块
管理员 → 进入 portal.html
```

## 5. 秘书处作为人员主数据中心

人员名单、建档、分组、职务、账号开通和模块权限，不应放在学委模块中维护。未来应由秘书处模块统一管理。

秘书处负责：

- 人员进班信息收集；
- 人员建档；
- 分班、分组；
- 职务管理；
- 是否开通系统账号；
- 给哪些模块权限；
- 人员状态维护，如在读、离班、转组等。

学委模块只调用秘书处维护的人员名单，用于排班和生成通知。

### 人员档案与账号分离

普通学员可以没有系统账号，但仍然需要有人员档案并可参与排班。

推荐基础表：

```text
people
- id
- name
- phone
- gender
- source_form_id
- status              -- active / left / suspended
- note
- created_at
- updated_at
```

可选账号关联：

```text
person_accounts
- id
- person_id
- user_id             -- auth.users.id
- enabled
- created_at
```

## 6. 学期化人员归属与职务

因为每个学期的人员、日程、排班都不一样，人员归属也应基于学期。

### 学期组织归属

```text
person_org_assignments
- id
- semester_id
- person_id
- org_id              -- 大班 / 班级 / 小组
- org_level           -- 大班 / 班级 / 小组
- status              -- active / transferred / left
- joined_at
- left_at
- sort_order
- created_at
- updated_at
```

### 职务管理

职务是现实业务身份，不等同于系统权限。

```text
person_positions
- id
- semester_id
- person_id
- org_id
- position_name       -- 学委 / 督察 / 班长 / 组长 / 秘书处等
- position_scope      -- 大班 / 班级 / 小组
- is_active
- created_at
- updated_at
```

例如，一个人现实中是“小组学委”，但只有开通账号并赋予 `module_memberships` 后，才可以登录系统操作学委模块。

## 7. 学委模块业务模型

学委模块核心不是简单“每天排几个人”，而是：

```text
课程内容库
  ↓
学期日程规则
  ↓
周计划
  ↓
日程实例
  ↓
岗位需求 / 摊派
  ↓
小组最终落人
  ↓
通知文案 / 排班表
```

学委模块所有学期相关数据都必须带 `semester_id`。

## 8. 课程内容库与临时课程

课程内容全局维护，不强制绑定学期。各学期日程可以引用课程库，也可以在日程中临时填写课程内容。

推荐表：

```text
study_course_library
- id
- chapter_no
- chapter_title
- theme
- title
- study_content
- thinking_questions
- paper_pages
- ebook_url
- sort_order
- is_active
- created_by
- created_at
- updated_at
```

日程实例中支持：

```text
course_id             -- 引用课程库，可为空
custom_title          -- 临时课程标题
custom_theme
custom_content
custom_question
custom_paper_pages
custom_ebook_url
```

## 9. 学期日程规则

日程可以统一设置，例如：

```text
周一：班级共读
周二：小组共读
周三：小组共读
周四：大班共读
```

推荐表：

```text
study_schedule_rules
- id
- semester_id
- weekday              -- 1-7
- scope_level          -- 大班 / 班级 / 小组
- title
- is_active
- created_at
- updated_at
```

该表用于按学期生成大班、班级、小组各自的日程实例。

## 10. 提前一周排班工作流

学委安排不是当天临时排，而是提前一周工作流：

```text
本周一开始安排下周全部内容
本周三每个小组将安排好的下周排班表在小组公示
```

推荐新增周计划概念：

```text
study_weekly_plans
- id
- semester_id
- week_start_date       -- 下周一
- week_end_date
- org_id                -- 大班 / 班级 / 小组
- scope_level
- status                -- draft / assigned / published / locked
- arrange_deadline      -- 本周一或实际安排开始时间
- publish_deadline      -- 本周三公示期限
- created_at
- updated_at
```

第一期可以先固定规则：

```text
本周一安排下周
本周三公示
```

后续再做可配置。

## 11. 三层级共读日程

学委日程支持三个层级：

### 小组共读

- 小组学委负责；
- 根据本小组全员名单直接排到具体人员；
- 每个小组的日程和人员安排可以不同。

### 班级共读

- 班级学委负责；
- 可以指定承办小组；
- 承办小组承担若干岗位；
- 参与小组承担若干岗位；
- 岗位最终摊派到小组，由小组落到具体人员。

### 大班共读

- 大班学委负责；
- 可以指定承办班级；
- 承办班级承担若干岗位；
- 参与班级承担若干岗位；
- 班级再摊派到小组；
- 小组最终落到具体人员。

## 12. 日程实例

推荐表：

```text
study_schedule_instances
- id
- weekly_plan_id
- semester_id
- schedule_date
- scope_level             -- 大班 / 班级 / 小组
- org_id                  -- 当前日程所属组织
- course_id               -- 可引用 study_course_library
- custom_title
- custom_theme
- custom_content
- custom_question
- custom_paper_pages
- custom_ebook_url
- status                  -- draft / active / cancelled
- note
- created_at
- updated_at
```

唯一约束建议：

```text
semester_id + schedule_date + scope_level + org_id
```

## 13. 岗位模板

不同共读层级可以有不同岗位需求。

推荐表：

```text
study_role_templates
- id
- semester_id
- scope_level          -- 大班 / 班级 / 小组
- role_name            -- 主持人 / 聆听者 / 分享人 / 回应砥砺 / 总结赋能 / 播控 / 拍照
- default_count
- sort_order
- is_active
```

常见岗位：

```text
主持人
聆听者
分享人
回应砥砺
总结赋能
播控
拍照
```

## 14. 岗位摊派模型

班级共读和大班共读都不是直接一步排到人，而是逐层摊派。

推荐表：

```text
study_assignment_demands
- id
- schedule_instance_id
- from_org_id              -- 发起摊派的组织
- target_org_id            -- 被摊派的组织
- target_level             -- 班级 / 小组
- demand_type              -- organizer / participant
- role_name
- required_count
- note
- created_at
- updated_at
```

示例：大班共读摊派到班级。

```text
from_org_id = 第一大班
target_org_id = 三班
demand_type = organizer
role_name = 主持人
required_count = 1
```

示例：班级共读摊派到小组。

```text
from_org_id = 三班
target_org_id = 致良组
demand_type = participant
role_name = 回应砥砺
required_count = 1
```

## 15. 小组最终落人

最终人员安排必须落到小组成员，或允许手动填写外部人员。

推荐表：

```text
study_assignment_people
- id
- demand_id
- person_id              -- 可为空，引用 people
- person_name_snapshot   -- 历史显示姓名
- source_type            -- person / manual
- note
- created_at
- updated_at
```

说明：

- 从人员名单选择时，保存 `person_id` 和姓名快照；
- 临时外部人员 `person_id` 可为空；
- 如果一个岗位要求 2 人，就新增两条人员记录。

## 16. 小组一周排班表

每个小组都需要生成自己的下周排班表，用于周三小组公示。

小组一周排班表应汇总三类来源：

1. 小组自己的小组共读安排；
2. 班级摊派给本组的任务；
3. 大班经班级继续摊派后落到本组的任务。

示例：

```text
【致良组下周学习排班表】
时间：2026-06-08 ~ 2026-06-14

周一｜班级共读
主持人：张三
播控：李四

周二｜小组共读
主持人：王五
分享人：赵六
拍照：张三

周三｜小组共读
主持人：李四
回应砥砺：王五

周四｜大班共读
分享人：赵六
拍照：张三
```

第一期先生成文本版，支持复制到微信群。后续再生成图片卡片。

## 17. 通知文案

第一期只做手动生成文案，不做自动推送。

可按层级生成不同模板：

### 小组通知

```text
【今日小组晨读安排】
日期：
课程：
学习内容：
思考题：
人员安排：
主持人：
分享人：
回应砥砺：
拍照：
```

### 班级通知

```text
【今日班级共读安排】
日期：
课程：
承办小组：
参与小组：
各小组岗位：
学习内容：
思考题：
```

### 大班通知

```text
【今日大班共读安排】
日期：
课程：
承办班级：
参与班级：
各班级岗位：
学习内容：
思考题：
```

后续自动推送时新增：

```text
study_wechat_configs
study_notice_logs
study-notification Edge Function
```

## 18. 优秀作业与展示卡片

后续阶段实现优秀作业：

```text
study_homeworks
- id
- semester_id
- org_id
- schedule_instance_id
- student_name
- title
- content
- image_urls
- source_url
- recommender_name
- status              -- submitted / selected / rejected / pushed
- selected_reason
- created_by
- created_at
- updated_at
```

展示卡片：

```text
study_showcase_cards
- id
- semester_id
- org_id
- title
- card_data
- image_url
- status              -- draft / pushed
- pushed_at
- created_by
- created_at
```

后续参考现有证书/榜单卡片生成思路，生成优秀作业展示图并推送企业微信群。

## 19. 页面规划

### 平台层

```text
portal.html                     # 模块入口
module-memberships.html         # 模块身份管理，后续
```

### 秘书处模块

```text
secretariat-dashboard.html
secretariat-intake-form.html
secretariat-people.html
secretariat-org-assignment.html
secretariat-positions.html
secretariat-accounts.html
secretariat-permissions.html
```

### 督察模块

第一阶段保留现有页面：

```text
index.html
attendance-page.html
summary-page.html
leaderboard.html
schedule-management.html
assessment-management.html
reminder-settings.html
org-management.html
data-management.html
```

后续再考虑改名为 `supervision-*`。

### 学委模块

```text
study-dashboard.html
study-course-library.html
study-schedule-rules.html
study-weekly-plans.html
study-assignment-demands.html
study-assignment-people.html
study-weekly-roster.html
study-notice.html
study-homework.html
study-showcase.html
study-settings.html
```

## 20. 分阶段实施路线

### Phase 0：保存完整规划

- 保存本文档；
- 不改业务代码；
- 不改数据库；
- 不改登录逻辑。

### Phase 1：平台入口与登录分流

- 新增 `portal.html`；
- 管理员进入平台入口；
- 普通督察账号仍直接进入现有督察首页；
- 不移动现有督察页面。

### Phase 2：人员中心 / 秘书处基础

- 设计/新增 `people`；
- 设计/新增 `person_org_assignments`；
- 设计/新增 `person_positions`；
- 设计/新增 `module_memberships`；
- 老督察账号迁移为 `supervision` 模块身份。

### Phase 3：学委课程库与日程规则

- 新增课程库；
- 新增周几共读层级规则；
- 支持按学期生成日程实例；
- 支持日程引用课程库或临时填写课程。

### Phase 4：学委周计划与摊派

- 支持本周一安排下周；
- 大班摊派到班级；
- 班级摊派到小组；
- 小组最终落到具体人员。

### Phase 5：小组一周排班表

- 汇总小组共读、班级摊派、大班摊派；
- 生成文本版小组周排班表；
- 支持周三公示复制。

### Phase 6：企业微信自动推送与卡片

- 新增企业微信配置；
- 新增通知日志；
- 新增 Edge Function 自动推送；
- 生成排班表图片；
- 生成优秀作业展示卡片并推送。

## 21. 暂不做事项

第一阶段暂不做：

- 不重命名现有督察页面；
- 不废弃 `profiles.role`；
- 不把督察表立即改名为 `supervision_*`；
- 不做企业微信自动推送；
- 不做排班表图片；
- 不做优秀作业卡片；
- 不强制所有普通成员开通系统账号。

## 22. 风险点

1. **人员主数据边界。** 如果学委先维护名单，未来秘书处上线后会重复。应尽早确定秘书处/人员中心为主数据源。
2. **旧督察兼容。** 现有页面依赖 `profiles.role`，短期必须保留。
3. **三层级摊派复杂度。** 大班 → 班级 → 小组 → 人员的链路要分阶段做，不能一次性堆完。
4. **周计划状态管理。** 草稿、已分配、已公示、锁定状态需要清晰，否则容易反复改动造成混乱。
5. **课程库与临时课程并存。** 需要明确日程展示时优先使用临时内容还是课程库内容。
6. **自动推送幂等。** 后续企业微信定时推送必须避免重复发送。

## 23. 验证原则

每个阶段都应能独立验证：

- Phase 1：登录分流不影响普通督察使用；
- Phase 2：老账号能映射出督察模块身份；
- Phase 3：课程库和日程规则能生成正确日程；
- Phase 4：摊派链路能从大班/班级最终落到小组；
- Phase 5：小组一周排班表能完整汇总所有来源；
- Phase 6：通知和卡片推送不重复、不漏发。

## 24. 当前确认的产品决策

- 平台入口文件名使用 `portal.html`。
- 学委模块文件前缀使用 `study-*`。
- 普通老督察账号登录后直接进入督察系统，不显示模块选择菜单。
- 管理员进入平台入口。
- 学委日程支持大班、班级、小组三个层级。
- 每个大班、班级、小组都有自己的日程表。
- 小组共读由小组学委直接排人。
- 班级共读由班级学委排班并摊派到小组。
- 大班共读由大班学委排班，先摊派到班级，再由班级摊派到小组。
- 人员名单应由未来秘书处/人员中心统一维护。
- 学委模块调用人员名单，不作为人员主数据源。
- 普通成员不要求开通系统账号。
- 第一阶段通知只生成文案，不自动推送。
- 课程内容全局维护，日程可引用，也可临时手填。
- 排班提前一周进行，本周一安排下周，本周三公示小组下周排班表。
