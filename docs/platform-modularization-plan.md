# 阳明心学班级管理平台模块化规划

> 本文档是给后续开发模型直接执行用的规划说明。  
> 当前项目最早是“督察管理系统”，现在要升级为“阳明心学班级管理平台”。  
> 开发时必须先理解：平台的核心边界不是“督察 + 几个新页面”，而是“以学期为边界的班级运营平台”。

## 0. 开发注意事项

后续开发模型执行本规划时，请先遵守以下限制：

1. 不要破坏现有督察模块。
2. 不要删除 `profiles.role`。
3. 不要删除 `profiles.organization_id`。
4. 不要一次性重构所有旧督察页面。
5. 不要把组织、人员、职务、权限分别散落到督察、学委、宣委模块中维护。
6. 当前工作区可能已有未提交修改，尤其注意不要覆盖：
   - `study-course-detail.html`
   - `study-course-library.html`
7. 现阶段项目是原生 HTML/CSS/JS + Supabase，不要引入前端构建系统。
8. 页面文件可以暂时保持旧文件名，先修正“归属、导航、权限、数据模型”，不要为了改名制造大风险。

## 1. 项目背景

当前项目已经完成了较多“督察管理”功能，包括：

- 督察首页；
- 考勤填报；
- 考核项目；
- 日程管理；
- 数据汇总；
- 榜单证书；
- 企业微信提醒；
- 操作日志；
- 组织管理；
- 学期设置。

现在项目要扩展为“阳明心学班级管理平台”，新增或规划中的模块包括：

- 督察；
- 学委；
- 秘书处；
- 未来宣委；
- 未来其他班级运营模块。

重要业务事实：

1. 每个学期的组织架构可能不同。
2. 每个学期的人员名单可能不同。
3. 每个学期的分班、分组可能不同。
4. 每个学期的职务可能不同。
5. 每个学期的模块权限可能不同。
6. 每个学期的督察日程、学委日程、排班、通知都不同。
7. 课程内容库可以跨学期复用，所以课程内容库不应该强绑定某一个学期。
8. 系统同一时间只有一个“当前学期”。
9. 普通用户只能进入当前学期相关功能，不能进入往期学期功能。

因此，平台的基础逻辑应该是：

```text
一套登录账号
一套人员主数据
多个学期
系统自动判断当前生效学期
当前学期拥有一套组织架构、人员归属、职务、模块权限
业务模块只围绕当前学期运作
```

## 2. 最新产品边界

平台分为三层：

```text
平台管理员层
├─ 学期管理
├─ 课程内容库
├─ 平台入口
├─ 全局账号 / 管理员
├─ 操作日志 / 审计
└─ 跨模块基础配置

秘书处运营层
├─ 当前学期组织架构
├─ 当前学期人员档案
├─ 当前学期分班分组
├─ 当前学期职务
└─ 当前学期模块权限

业务模块层
├─ 督察：考勤、考核、提醒、汇总、榜单
├─ 学委：日程、周计划、岗位摊派、排班、通知、优秀作业
└─ 宣委：未来宣传、素材、展示、推送等
```

### 2.1 平台管理员负责什么

平台管理员负责“平台级、跨模块、跨学期、可复用、审计类”的能力。

平台管理员管理：

- 学期管理；
- 课程内容库；
- 平台入口；
- 超级管理员和管理员账号；
- 平台操作日志；
- 跨模块配置；
- 后续可能的系统设置、数据备份、审计报表。

注意：

- 学期管理不归秘书处。
- 课程内容库不归学委。
- 操作日志不归督察。

### 2.2 秘书处负责什么

秘书处负责“一个学期内班级怎么运转”。

秘书处管理：

- 组织架构；
- 人员档案；
- 人员进班、离班、转组；
- 分班；
- 分组；
- 职务；
- 模块权限；
- 人员和账号的关联。

秘书处是人员主数据和学期运营数据中心。

学委、督察、宣委不应该各自维护一套人员名单。

### 2.3 督察负责什么

督察模块负责督察业务：

- 考勤；
- 考核；
- 督察日程；
- 数据汇总；
- 榜单；
- 证书；
- 督察提醒。

督察模块可以写入操作日志，但不拥有操作日志管理页。

### 2.4 学委负责什么

学委模块负责学习委员业务：

- 学期日程规则；
- 周计划；
- 大班、班级、小组共读日程；
- 岗位需求；
- 岗位摊派；
- 小组最终落人；
- 一周排班表；
- 通知文案；
- 优秀作业。

学委模块可以引用课程内容库，但不管理课程内容库主数据。

### 2.5 未来宣委负责什么

宣委模块未来负责宣传业务，例如：

- 宣传素材；
- 图片、文案、视频；
- 活动展示；
- 优秀内容发布；
- 推送记录。

宣委模块也应该消费秘书处维护的学期组织和人员数据。

### 2.6 当前学期是全系统唯一上下文

平台不是让普通用户自由选择任意学期。

平台应该有一个全系统唯一的“当前学期”。

例如：

```text
当前学期 = 阳明心学第14期
```

此时：

- 只有阳明心学第14期有权限的账号可以进入系统；
- 登录后看到的是阳明心学第14期的组织、人员、职务、模块入口；
- 督察、学委、秘书处、宣委都只处理阳明心学第14期数据；
- 阳明心学第13期、第12期等往期账号不能进入当前系统入口；
- 往期数据可以保留，但普通业务人员不能通过入口继续操作。

当管理员新增：

```text
阳明心学第15期
```

并设置它的生效时间后，一旦到达生效时间：

```text
当前学期自动切换为阳明心学第15期
```

此时：

- 阳明心学第14期账号不能再进入业务入口；
- 只有阳明心学第15期有权限的账号可以进入系统；
- 所有模块入口都变成阳明心学第15期入口；
- 所有组织、人员、职务、排班、考勤、通知都基于第15期。

如果管理员手动把当前学期切回：

```text
阳明心学第14期
```

则系统再次只允许阳明心学第14期账号进入，入口和业务数据也全部回到第14期。

注意：

- 平台管理员可以查看和管理历史学期。
- 普通秘书处、学委、督察、宣委只允许操作当前学期。
- 当前学期不是页面筛选条件，而是登录、权限、入口、业务数据的全局上下文。

## 3. 数据分层原则

所有数据先按生命周期分层，再决定放在哪个模块页面里。

### 3.1 全局数据

全局数据不强绑定学期。

```text
auth.users
profiles
people
study_course_library
平台管理员配置
系统操作日志基础表
```

说明：

- `auth.users` 是 Supabase 登录账号。
- `profiles` 是当前旧系统已有账号资料，短期保留。
- `people` 是人员主档案，普通学员即使没有账号也应该进入 `people`。
- `study_course_library` 是课程内容库，可以被多个学期复用。

### 3.2 学期数据

只要数据会随学期变化，就必须带 `semester_id`。

```text
organizations
person_org_assignments
person_positions
module_memberships
督察日程
督察考勤
督察考核
学委日程规则
学委日程实例
学委周计划
学委岗位摊派
学委人员落位
未来宣委业务数据
```

重点：

- 每个学期的组织架构不同，所以组织架构要能按学期区分。
- 每个学期的人员归属不同，所以人员组织归属必须带 `semester_id`。
- 每个学期的职务不同，所以职务必须带 `semester_id`。
- 每个学期的模块权限不同，所以模块权限也应该支持 `semester_id`。

### 3.3 旧系统兼容数据

旧督察系统已经依赖以下字段：

```text
profiles.role
profiles.organization_id
```

短期必须保留。

后续可以让新模块逐步转向：

```text
people
person_org_assignments
person_positions
module_memberships
```

但不要在第一轮强行废弃旧字段。

## 4. 账号、人员、职务、权限的区别

后续开发必须区分四个概念。

### 4.1 登录账号

登录账号表示“这个人能不能登录系统”。

对应：

```text
auth.users
profiles
```

### 4.2 人员档案

人员档案表示“班级里有这个人”。

对应：

```text
people
```

普通学员可以没有登录账号，但仍然必须能被建档、分组、排班。

### 4.3 职务

职务表示“这个人在现实班级运营中担任什么职责”。

对应：

```text
person_positions
```

例如：

- 大班学委；
- 班级学委；
- 小组学委；
- 督察；
- 班长；
- 组长；
- 秘书处成员；
- 宣委。

职务不等于系统权限。

### 4.4 模块权限

模块权限表示“这个人能不能进入某个系统模块并执行操作”。

对应：

```text
module_memberships
```

例如：

- 张三现实中是小组学委；
- 但只有给他开通学委模块权限后；
- 他才能登录系统操作学委模块。

## 5. 推荐数据库模型

### 5.1 人员档案 `people`

```text
people
- id
- name
- phone
- gender
- status
- note
- created_at
- updated_at
```

说明：

- `people` 是全局人员档案。
- 不要给 `people` 强制加 `semester_id`。
- 同一个人跨学期仍然是同一个人员档案。

### 5.2 人员账号关联 `person_accounts`

如果后续要更清楚地区分人员和账号，建议新增：

```text
person_accounts
- id
- person_id
- user_id
- enabled
- created_at
- updated_at
```

说明：

- `person_id` 指向 `people.id`。
- `user_id` 指向 `auth.users.id` 或 `profiles.id`。
- 一个普通成员没有账号时，可以没有这条记录。

### 5.3 学期组织归属 `person_org_assignments`

```text
person_org_assignments
- id
- semester_id
- person_id
- org_id
- org_level
- status
- joined_at
- left_at
- sort_order
- created_at
- updated_at
```

说明：

- 这个表表示“某人在某学期属于哪个组织”。
- 学委排班、督察管理、宣委任务都应该从这个表读取人员名单。

### 5.4 学期职务 `person_positions`

```text
person_positions
- id
- semester_id
- person_id
- org_id
- position_name
- position_scope
- is_active
- created_at
- updated_at
```

说明：

- 这个表表示现实职务。
- 它不控制系统能不能访问页面。

### 5.5 模块权限 `module_memberships`

当前已有 `module_memberships`，但建议补充 `semester_id`。

推荐结构：

```text
module_memberships
- id
- semester_id
- user_id
- person_id
- module_key
- role
- org_id
- enabled
- created_at
- updated_at
```

字段说明：

- `semester_id`：这个权限属于哪个学期。
- `user_id`：登录账号。
- `person_id`：人员档案。
- `module_key`：模块，例如 `supervision`、`study`、`secretariat`、`publicity`、`admin`。
- `role`：模块内角色。
- `org_id`：权限作用范围，例如某个大班、班级、小组。
- `enabled`：是否启用。

特殊说明：

- 平台超级管理员可以是全局权限，`semester_id` 可以为空，或者用单独的管理员判断逻辑。
- 普通秘书处、学委、督察、宣委权限建议带 `semester_id`。

## 6. 操作日志归属

操作日志必须归平台管理员管理。

原督察模块已有 `audit-log.html`，后续应该把它定位为平台审计页面，而不是督察页面。

### 6.1 操作日志为什么不是督察功能

操作日志记录的是：

```text
谁
在什么时间
在哪个模块
对什么数据
做了什么操作
```

这属于平台审计，不属于某一个业务模块。

以后以下模块都会产生日志：

- 督察；
- 学委；
- 秘书处；
- 宣委；
- 管理员后台。

所以日志查看、筛选、导出应该由平台管理员负责。

### 6.2 操作日志建议字段

如果现有 `audit_logs` 字段不够，后续建议逐步补充：

```text
audit_logs
- id
- module_key
- semester_id
- actor_user_id
- actor_person_id
- action
- target_type
- target_id
- target_name_snapshot
- detail
- ip_address
- user_agent
- created_at
```

说明：

- `module_key` 用来区分日志来自督察、学委、秘书处、宣委还是平台管理。
- `semester_id` 用来区分日志属于哪个学期。
- `actor_user_id` 是登录账号。
- `actor_person_id` 是人员档案。
- `target_type` 是被操作对象类型，例如 `course`、`person`、`organization`、`attendance`。
- `detail` 可以存 JSON。

### 6.3 页面归属

```text
audit-log.html
```

短期可以保留文件名。

但页面入口应该从督察导航移出，放入平台管理员导航。

## 7. 课程内容库归属

课程内容库应该归平台管理员管理。

原因：

- 课程内容可以跨学期复用；
- 课程内容不是某一个学期的排班结果；
- 学委只是引用课程内容来安排日程。

### 7.1 表归属

```text
study_course_library
```

虽然表名里有 `study`，但产品归属应理解为：

```text
平台管理员管理的学习内容资产库
```

短期不必改表名。

### 7.2 页面归属

```text
study-course-library.html
```

短期可以保留文件名。

但页面入口应该放到平台管理员后台或平台入口中。

学委模块中如果需要使用课程，只做“选择课程 / 查看课程”，不要默认拥有课程库 CRUD 权限。

## 8. 学期管理归属

学期管理应该归平台管理员管理。

原因：

- 学期是全平台边界；
- 督察、学委、秘书处、宣委都依赖学期；
- 学期不是秘书处单独业务数据。
- 当前学期决定谁能登录、能看见哪些入口、能操作哪一套业务数据。

### 8.1 当前学期生效规则

学期应该支持“生效时间”。

推荐学期表至少包含：

```text
semesters
- id
- name
- start_date
- end_date
- effective_at
- status
- is_current
- created_at
- updated_at
```

字段说明：

- `name`：例如 `阳明心学第14期`、`阳明心学第15期`。
- `start_date`：业务上的开班日期。
- `end_date`：业务上的结业日期。
- `effective_at`：系统切换为当前学期的生效时间。
- `status`：例如 `draft`、`active`、`archived`。
- `is_current`：是否为当前学期。

当前学期判断规则：

```text
优先使用 is_current = true 的学期
如果没有手动指定，则按 effective_at <= 当前时间 的最新学期作为当前学期
全系统同一时间只能有一个当前学期
```

实现要求：

1. 普通业务页面不要让用户自由选择学期。
2. 普通业务页面应该统一读取当前学期。
3. 登录后入口也应该基于当前学期生成。
4. 管理员可以在学期管理中手动切换当前学期。
5. 管理员手动切换后，系统立即使用新当前学期。
6. 如果配置了生效时间，到达生效时间后系统应自动把新学期识别为当前学期。

示例：

```text
2026-06-01 00:00 之前
当前学期 = 阳明心学第14期

2026-06-01 00:00 之后
如果阳明心学第15期 effective_at = 2026-06-01 00:00
则当前学期 = 阳明心学第15期
```

### 8.2 当前学期切换后的账号和入口规则

当前学期切换后，账号入口必须一起切换。

例如当前学期是：

```text
阳明心学第15期
```

则：

- 只有第15期 `module_memberships` 有效的账号可以进入业务模块；
- 第14期人员即使以前有账号，也不能进入第15期业务入口；
- 第14期人员如果在第15期继续参加，需要由秘书处在第15期重新分配组织、职务、模块权限；
- 页面上的组织架构、人员列表、日程、排班、考勤都读取第15期数据。

当管理员切回：

```text
阳明心学第14期
```

则：

- 只有第14期权限有效；
- 第15期权限不再决定当前入口；
- 功能入口恢复为第14期上下文。

注意：

- 这里的“账号不能进入”不是删除账号。
- 账号仍然存在，只是没有当前学期权限，所以不能进入当前业务入口。
- 平台管理员不受这个限制，可以管理学期和查看历史数据。

### 8.3 页面归属

当前页面：

```text
secretariat-semesters.html
semester-settings.html
```

建议：

- 短期不急着改文件名；
- 但导航和页面标题要统一为“平台管理员 / 学期管理”；
- 后续稳定后可以改名为 `admin-semesters.html`。

### 8.4 秘书处如何使用学期

秘书处进入页面时应该读取当前学期。

秘书处不创建平台学期，而是在某个学期下维护：

- 组织架构；
- 人员归属；
- 职务；
- 模块权限。

普通秘书处成员不应该自由切换历史学期进行操作。

如果需要查看历史学期，应由平台管理员提供只读入口或审计入口。

### 8.5 顶层组织由管理员创建

组织架构的顶层应由平台管理员在学期管理或平台组织初始化中创建。

例如当前学期是：

```text
阳明心学第15期
```

管理员先创建顶层组织：

```text
阳明心学第15期
└─ 第一大班
```

然后管理员为这个顶层组织配置管理人员：

```text
第一大班
├─ 班长
├─ 秘书长
├─ 大班学委
├─ 大班督察
└─ 其他必要岗位
```

这些管理人员获得对应职务和模块权限后，才可以继续运作。

后续由他们添加和维护下级组织：

```text
第一大班
├─ 一班
│  ├─ 致良组
│  └─ 诚意组
└─ 二班
   ├─ 正心组
   └─ 修身组
```

职责划分：

```text
平台管理员
  → 创建学期
  → 设置当前学期 / 生效时间
  → 创建顶层组织，例如大班
  → 给顶层组织配置核心管理人员和权限

顶层管理人员 / 秘书处
  → 创建下级班级、小组
  → 添加人员
  → 分配人员组织归属
  → 设置职务
  → 分配模块权限

业务模块人员
  → 在已有组织和权限范围内开展督察、学委、宣委业务
```

重要规则：

- 没有顶层组织，后续业务模块无法正常运作。
- 没有顶层管理人员，下级组织和人员无法被维护。
- 没有当前学期权限，账号不能进入对应模块。
- 组织架构必须归属于学期。

## 9. 页面归属规划

### 9.1 平台管理员页面

```text
portal.html                       # 平台入口
secretariat-semesters.html        # 当前文件名保留，产品归属改为平台学期管理
study-course-library.html         # 当前文件名保留，产品归属改为平台课程内容库
audit-log.html                    # 平台操作日志 / 审计
```

后续可新增：

```text
admin-dashboard.html
admin-semesters.html
admin-course-library.html
admin-audit-log.html
admin-settings.html
```

但不建议第一轮为了改名影响现有链接。

### 9.2 秘书处页面

```text
secretariat-dashboard.html
secretariat-org-management.html
secretariat-people.html
```

秘书处页面只处理当前学期的班级运营数据。

秘书处人员管理页应整合：

- 人员档案；
- 学期组织归属；
- 职务；
- 模块权限；
- 是否关联登录账号。

不要再拆成多个互相独立、数据重复的页面。

### 9.3 学委页面

```text
study-dashboard.html
study-schedule-rules.html
study-weekly-assignment.html
study-course-detail.html
```

说明：

- `study-schedule-rules.html` 管理当前学期日程规则；
- `study-weekly-assignment.html` 管理当前学期周计划、摊派、落人；
- `study-course-detail.html` 可以作为课程查看页；
- 课程编辑权限要看用户是否是平台管理员。

### 9.4 督察页面

短期保留：

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
my-records.html
profile.html
certificate-render.html
```

注意：

- `audit-log.html` 从督察归属移到平台管理员归属。
- `org-management.html` 后续应逐步迁移到秘书处组织架构。
- `semester-settings.html` 后续应逐步迁移到平台管理员学期管理。

## 10. 学委模块业务模型

学委模块核心流程：

```text
课程内容库
  ↓
当前学期日程规则
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

注意：

- 课程内容库是全局复用数据。
- 从日程规则开始都是学期数据。
- 学委模块必须从秘书处维护的组织和人员表读取人员。

### 10.1 课程内容库

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

说明：

- 不强制绑定学期。
- 平台管理员维护。
- 学委日程引用。

### 10.2 学期日程规则

```text
study_schedule_rules
- id
- semester_id
- weekday
- scope_level
- title
- is_active
- created_at
- updated_at
```

例如：

```text
周一：班级共读
周二：小组共读
周三：小组共读
周四：大班共读
```

### 10.3 日程实例

```text
study_schedule_instances
- id
- semester_id
- schedule_date
- scope_level
- org_id
- course_id
- custom_title
- custom_theme
- custom_content
- custom_question
- custom_paper_pages
- custom_ebook_url
- note
- created_by
- created_at
- updated_at
```

说明：

- 可以引用课程库。
- 也可以临时填写课程内容。
- 临时课程内容只属于这个日程实例。

### 10.4 岗位摊派

```text
study_assignment_demands
- id
- schedule_instance_id
- from_org_id
- target_org_id
- target_level
- demand_type
- role_name
- required_count
- note
- created_by
- created_at
- updated_at
```

说明：

- 大班共读可以摊派到班级；
- 班级共读可以摊派到小组；
- 最终由小组落到人。

### 10.5 小组最终落人

```text
study_assignment_people
- id
- demand_id
- person_id
- person_name_snapshot
- source_type
- note
- created_by
- created_at
```

说明：

- `person_id` 指向 `people`；
- `person_name_snapshot` 用于保留历史显示；
- 如果是临时外部人员，`person_id` 可以为空，`source_type = manual`。

## 11. 三层级共读逻辑

### 11.1 小组共读

小组共读由小组学委负责。

流程：

```text
小组日程
→ 读取本学期本小组成员
→ 直接安排到具体人员
→ 生成小组通知
```

### 11.2 班级共读

班级共读由班级学委负责。

流程：

```text
班级日程
→ 指定承办小组或参与小组
→ 设置岗位需求
→ 摊派到小组
→ 小组落到具体人员
→ 生成班级通知和小组排班表
```

### 11.3 大班共读

大班共读由大班学委负责。

流程：

```text
大班日程
→ 指定承办班级或参与班级
→ 设置岗位需求
→ 摊派到班级
→ 班级再摊派到小组
→ 小组落到具体人员
→ 生成大班通知和小组排班表
```

## 12. 旧督察兼容策略

现有督察账号和页面不能被破坏。

短期继续保留：

```text
profiles.role
profiles.organization_id
```

短期继续保留旧督察页面：

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

后续迁移方向：

1. 督察页面继续可用。
2. 新增数据先按新模型写。
3. 等秘书处人员和组织稳定后，再逐步让督察读取新组织和人员模型。
4. 不要一次性把督察表全部改名为 `supervision_*`。

## 13. 登录和入口分流

推荐逻辑：

```text
用户登录
→ 读取 profiles
→ 判断是否平台管理员
→ 读取当前学期
→ 读取当前学期的 module_memberships
→ 判断当前学期是否有有效模块权限
→ 根据当前学期权限决定进入 portal.html 或某个模块首页
```

核心规则：

```text
超级管理员 / 管理员
  → portal.html
  → 可以管理学期、课程库、操作日志
  → 可以查看历史学期

当前学期没有任何有效模块权限的普通账号
  → 禁止进入业务系统
  → 提示“当前学期暂无权限，请联系管理员或秘书处”

当前学期有多个模块身份的用户
  → portal.html
  → 只显示当前学期可进入的模块

当前学期只有一个模块身份的用户
  → 可直接进入对应模块
```

注意：

- `portal.html` 应该只显示当前学期有权限访问的模块。
- 平台管理员应看到平台管理入口。
- 秘书处成员应看到秘书处入口。
- 学委成员应看到学委入口。
- 督察成员应看到督察入口。
- 往期学期的模块权限不能让用户进入当前系统入口。
- 切换当前学期后，入口必须重新按新当前学期计算。

旧督察兼容说明：

- 如果当前学期仍然是老督察所在学期，可以继续按兼容逻辑进入督察。
- 如果当前学期已经切换到新学期，老学期督察账号不能仅凭 `profiles.role` 进入新学期。
- 后续应尽量把督察账号也迁移为带 `semester_id` 的 `module_memberships`。
- `profiles.role` 只能作为历史兼容，不应该绕过当前学期权限。

## 14. 权限规则建议

### 14.1 平台管理员

平台管理员可以：

- 管理学期；
- 设置当前学期；
- 设置学期生效时间；
- 创建当前学期顶层组织；
- 给顶层组织配置核心管理人员；
- 管理课程内容库；
- 查看操作日志；
- 管理全局配置；
- 进入各模块查看或协助处理。

### 14.2 秘书处

秘书处可以：

- 管理当前学期组织架构；
- 管理当前学期人员归属；
- 管理当前学期职务；
- 管理当前学期模块权限。

秘书处不应该默认能修改课程内容库，除非同时拥有平台管理员权限。

秘书处不应该创建平台学期。

秘书处不应该随意切换当前学期。

秘书处在当前学期内可以继续创建下级组织、添加人员、配置职务和权限。

### 14.3 学委

学委可以：

- 管理自己权限范围内的学委日程；
- 管理周计划；
- 做岗位摊派；
- 给本范围内小组落人；
- 生成通知文案。

学委不应该默认能修改人员主数据。

学委不应该默认能修改课程内容库。

### 14.4 督察

督察可以：

- 做督察考勤；
- 管理督察范围内的考核；
- 查看督察业务统计；
- 处理督察提醒。

督察不应该默认能管理平台操作日志。

## 15. 分阶段实施路线

### Phase 0：修正文档和产品口径 ✅ 已完成

口径已明确：管理员管平台，秘书处管本学期组织人员，学委管排班，督察管业务，日志归审计，课程库归平台资产。

### Phase 1：导航和页面归属修正 ✅ 已完成

> 实现文件：portal.html（重写为图标网格布局）、index.html、secretariat-dashboard.html（3列图标网格）、study-dashboard.html（2×2图标网格）

结论：
- portal.html：平台管理区（上）+ 学期功能区（下大容器，内含学期横幅+3个模块卡片），按权限动态显示/隐藏
- 秘书处和学委子页面全部图标化
- 所有返回链接改为智能返回（?from=portal 追踪来源）
- index.html 所有用户可见“切换模块”按钮

### Phase 2：当前学期机制和模块权限学期化 ✅ 已完成

> 实现文件：supabase/schema/20260607_001_module_memberships_semester_id.sql、
> supabase/schema/20260608_001_semesters_effective_at.sql、
> js/utils.js（guardModuleAccess、autoSwitchSemester）、login.html、secretariat-people.html

结论：
- module_memberships 加 semester_id，唯一索引更新
- semesters 加 effective_at，autoSwitchSemester() 在 getCurrentSemesterId 中自动触发切换
- login.html 按当前学期 module_memberships 数量分流（0→无权限提示，1→直达，多→portal）
- guardModuleAccess 通用拦截函数：管理员直接放行，普通用户查 module_memberships

### Phase 3：秘书处成为人员和组织中心 ✅ 已完成

> 实现文件：js/utils.js（guardModuleAccess）、secretariat-dashboard.html、secretariat-org-management.html、secretariat-people.html

结论：
- 秘书处所有页面加 guardModuleAccess('secretariat') 权限拦截
- secretariat-people.html 增删权限时带 semester_id
- 仪表板新增进班表单入口

### Phase 4：课程内容库管理员化 ✅ 已完成

> 实现文件：study-course-library.html、study-course-detail.html、
> supabase/fix/20260608_001_fix_study_courses_rls.sql

结论：
- RLS 修复：平台管理员直接管理 study_courses 表
- 非管理员隐藏编辑/删除/开关按钮，只读查看（含课程列表和章节详情）
- RLS 修复脚本已执行

### Phase 5：操作日志平台化 ✅ 已完成

> 实现文件：audit-log.html（全面重写）、supabase/schema/20260609_001_audit_logs_platform.sql、
> js/utils.js（logAction 升级带 moduleKey+semester_id）

结论：
- audit_logs 加 module_key 和 semester_id 字段
- 平台审计页：模块/学期/操作人/操作类型四维筛选 + 分页 + 日志标签 + 操作人高亮
- 降级兼容：列不存在时自动检测并跳过筛选
- SQL 迁移已执行，模块/学期筛选完整可用

### Phase 6：学委模块按新边界整理 ✅ 已完成

> 实现文件：study-dashboard.html、study-schedule-rules.html、study-weekly-assignment.html

结论：
- 学委所有页面加 guardModuleAccess('study') 权限拦截
- 仪表板 2×2 图标网格
- 日程规则/排班均已带 semester_id（建表时已有）

### Phase 7：督察旧系统逐步迁移 ⬜ 未开始

目标：保持旧督察可用，同时逐步接入新平台模型。先让平台入口和权限体系稳定后再迁移。

### Phase 8：进班表单（新增）✅ 已完成

> 实现文件：secretariat-entry-form.html（完整表单页）、
> entry_forms 表 + 3 个迁移（001基础/002v2优化/003手机号）

11 项字段 + 双历日期选择器（阳历+农历同显） + 34省365市2919区县拼音排序联动 + 表单/记录双视图。
## 16. 当前已知数据库迁移

> 更新于 2026-06-13。下列迁移已在当前 Supabase 项目中完成；后续新增迁移仍按本节规范维护。

### 已在本轮实施中创建的迁移

| 序号 | 文件 | 说明 | 状态 |
|------|------|------|------|
| 017 | `20260604_001_module_memberships.sql` | 平台模块身份表 | 已执行 |
| 018 | `20260604_002_people_foundation.sql` | 秘书处基础表（people、person_org_assignments、person_positions） | 已执行 |
| 019 | `20260604_003_study_foundation.sql` | 学委基础表（course_library、schedule_rules、schedule_instances） | 已执行 |
| 020 | `20260604_004_study_assignment.sql` | 学委摊派表（demands、people） | 已执行 |
| 021 | `20260607_001_module_memberships_semester_id.sql` | module_memberships 加 semester_id | 已执行 |
| 022 | `20260608_001_semesters_effective_at.sql` | semesters 加 effective_at | 已执行 |
| 023 | `20260609_001_audit_logs_platform.sql` | audit_logs 加 module_key/semester_id | 已执行 |
| 024 | `20260610_001_entry_forms.sql` | 进班表单表 entry_forms | 已执行 |
| 025 | `20260610_002_entry_forms_v2.sql` | entry_forms 字段优化 v2 | 已执行 |
| 026 | `20260610_003_entry_forms_phone.sql` | entry_forms 加 phone 字段 | 已执行 |
| fix | `20260608_001_fix_study_courses_rls.sql` | 课程合集 RLS 修复 | 已执行 |
| fix | `20260613_001_migrate_profiles_to_people_assignments.sql` | 旧 profiles 账号同步为 people，并迁移 organization_id 到当前学期人员归属 | 已执行 |

## 17. 推荐给开发模型的执行顺序

如果开发模型能力有限，请严格按这个顺序做：

1. 先读本文档。
2. 再读当前相关 HTML 页面。
3. 再读 `js/supabase-config.js`。
4. 再读 `js/utils.js`。
5. 再读 `js/components.js`。
6. 再读相关 SQL 迁移。
7. 先做导航和文案归属。
8. 再做权限判断。
9. 再做数据库迁移。
10. 最后做业务页面改造。

不要一开始就大规模改 HTML。

不要一开始就大规模改 SQL。

每一阶段做完都要验证页面能打开，旧督察功能不受影响。

## 18. 核心结论

本项目最终应该形成以下清晰结构：

```text
管理员管平台
秘书处管本学期的人和组织
学委管学习排班
督察管督察业务
宣委管宣传业务
操作日志归平台审计
课程内容库归平台内容资产
当前学期是登录、入口、权限、业务数据的唯一生效上下文
除课程内容库等可复用数据外，班级运营数据都围绕 semester_id 管理
```

这是后续所有开发、重构、权限判断、页面归属的最高原则。
