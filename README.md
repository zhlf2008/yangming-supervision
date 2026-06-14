# 阳明心学班级管理平台

面向阳明心学书院的班级运营平台，支持多学期、多层级组织（大班/班级/小组）的**督察管理、学委排班、秘书处运营**三大模块。

## 技术栈

- **前端**：原生 HTML + CSS + JavaScript（多页面应用）
- **后端**：Supabase（PostgreSQL + Auth + Edge Functions）
- **部署**：静态文件部署 + Supabase 托管

## 本地运行

```bash
# Python HTTP 服务器
python -m http.server 3000 --bind 0.0.0.0
# 访问 http://localhost:3000/login.html
```

## 项目结构

```
├── portal.html                     # 🏠 平台入口门户
│
├── 督察模块
│   ├── index.html                  # 督察首页
│   ├── attendance-page.html        # 考勤填报
│   ├── summary-page.html           # 数据汇总
│   ├── leaderboard.html            # 榜单证书
│   ├── schedule-management.html    # 日程管理
│   ├── assessment-management.html  # 考核项目管理
│   ├── data-management.html        # 数据管理
│   ├── semester-settings.html      # 学期设置（旧督察）
│   └── reminder-settings.html      # 填报提醒
│
├── 秘书处模块
│   ├── secretariat-dashboard.html          # 秘书处首页
│   ├── secretariat-org-management.html     # 组织架构
│   ├── secretariat-people.html             # 人员管理（归属/职务/账号/权限）
│   ├── secretariat-semesters.html          # 学期管理
│   └── secretariat-entry-form.html         # 进班表单
│
├── 学委模块
│   ├── study-dashboard.html         # 学委首页
│   ├── study-course-library.html    # 课程内容库
│   ├── study-course-detail.html     # 课程章节详情
│   ├── study-schedule-rules.html    # 日程规则
│   └── study-weekly-assignment.html # 每周排班
│
├── 公共页面
│   ├── login.html                   # 登录页
│   ├── profile.html                 # 个人中心
│   ├── audit-log.html               # 平台审计日志（管理员）
│   └── my-records.html              # 我的填报记录
│
├── js/
│   ├── supabase-config.js           # Supabase 客户端初始化
│   ├── utils.js                     # 公共工具函数（含权限拦截/学期切换/日志）
│   └── components.js                # 共享 UI 组件
├── css/
│   └── common.css                   # 全局样式
├── docs/
│   └── platform-modularization-plan.md  # 完整模块化规划文档
└── supabase/
    ├── MIGRATIONS.md                # 数据库迁移记录
    ├── schema/                      # 建表迁移
    ├── fix/                         # 修复脚本
    ├── rls/                         # RLS 策略
    └── functions/                   # Edge Functions
```

## 平台架构

```
portal.html（平台入口）
├── ⚙️ 平台管理（仅管理员）
│   ├── 学期管理 (secretariat-semesters.html)
│   ├── 课程内容库 (study-course-library.html)
│   └── 操作日志 (audit-log.html)
└── 📋 学期功能（按权限显示）
    ├── 督察管理 (index.html)
    ├── 秘书处 (secretariat-dashboard.html)
    └── 学委管理 (study-dashboard.html)
```

## 权限体系

- **超级管理员/管理员**：全部功能、全部模块
- **模块权限**：通过 `module_memberships` 表按学期分配（supervision / secretariat / study）
- **页面级拦截**：`guardModuleAccess(moduleKey)` 统一拦截非授权访问
- **登录分流**：按当前学期 module_memberships 数量自动决定入口

## 核心数据模型

```
profiles             登录账号
people               人员档案（跨学期）
semesters            学期（含 effective_at 自动切换）
module_memberships   模块权限（含 semester_id）
organizations        组织树（含 semester_id）
person_org_assignments  学期组织归属
person_positions         职务
entry_forms              进班表单
study_course_library     课程内容库
study_schedule_rules     日程规则
study_schedule_instances 日程实例
study_assignment_demands 岗位摊派
study_assignment_people  人员落位
audit_logs               操作日志（含 module_key/semester_id）
```

说明：`org-management.html` 仅作为旧链接兼容跳转到 `secretariat-org-management.html`，督察模块不再提供组织架构和人员管理入口；新增登录账号、人员归属、职务和模块权限统一在 `secretariat-people.html` 处理。

## 数据库迁移

所有迁移文件在 `supabase/schema/` 下，按日期序号执行。详见 `supabase/MIGRATIONS.md`。

当前最新迁移：
- 021: module_memberships 加 semester_id
- 022: semesters 加 effective_at
- 023: audit_logs 加 module_key/semester_id
- 024-026: 进班表单 entry_forms 表
