# 阳明心学督察管理系统

面向阳明心学书院的督察管理系统，支持多学期、多层级组织（大班/班级/小组）的考勤填报、日程管理、考核率汇总与排名。

## 技术栈

- **前端**：原生 HTML + CSS + JavaScript（多页面应用）
- **后端**：Supabase（PostgreSQL + Auth + Edge Functions）
- **部署**：静态文件部署 + Supabase 托管

## 本地运行

直接用浏览器打开任意 HTML 文件即可（推荐使用 Live Server）。无需构建工具。

```
# 如果用 VS Code
code .
# 安装 Live Server 插件，右键 HTML → Open with Live Server
```

## 环境变量

在 Supabase Dashboard → Settings → API 中获取以下值，配置到 `js/supabase-config.js`：

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

## 项目结构

```
├── index.html                    # 首页入口
├── login.html                    # 登录页
├── attendance-page.html          # 考勤填报
├── schedule-management.html      # 日程管理
├── assessment-management.html    # 考核项目管理
├── summary-page.html             # 数据汇总
├── leaderboard.html              # 考核率排名
├── my-records.html               # 我的填报记录
├── data-management.html          # 数据管理（管理员）
├── org-management.html           # 组织管理（管理员）
├── semester-settings.html        # 学期设置（管理员）
├── profile.html                  # 个人中心
├── reminder-settings.html        # 填报提醒设置（管理员）
├── audit-log.html                # 操作日志（管理员）
├── js/
│   ├── supabase-config.js        # Supabase 客户端初始化
│   ├── utils.js                  # 公共工具函数
│   └── components.js             # 共享 UI 组件
├── css/
│   └── common.css                # 全局样式
└── supabase/
    ├── MIGRATIONS.md             # 数据库迁移记录
    ├── 20250427_001_init_tables.sql
    ├── 20250427_002_reminder_and_audit.sql
    ├── 20250508_001_rls_orgs_profiles.sql
    ├── 20250508_002_role_rename.sql
    ├── 20250508_003_semester_isolation.sql
    ├── 20250508_004_schedules_per_daban.sql
    ├── functions/
    │   ├── admin-user/           # 管理员操作 Edge Function
    │   └── clever-endpoint/      # 企业微信提醒 webhook
    └── dev/                      # 开发诊断脚本
        └── diagnose_reminder.sql
```

## 页面与功能

| 页面 | 功能 | 访问角色 |
|------|------|----------|
| 考勤填报 | 按小组填报当日考核数据，自动计算上线率/视频率/作业率 | 小组督察及以上 |
| 日程管理 | 按大班配置每日考核项目、生成学期日程 | 大班总督及以上 |
| 考核项目管理 | 配置考核字段、公式、模板 | 管理员 |
| 数据汇总 | 按期查看各小组出勤率、考核率汇总 | 所有用户 |
| 考核率排名 | 按班级/大班排名 | 所有用户 |
| 我的填报记录 | 查看自己的历史填报 | 所有用户 |
| 数据管理 | 查看/导出所有填报记录 | 管理员 |
| 组织管理 | 管理大班/班级/小组层级结构 | 管理员 |
| 学期设置 | 创建/切换学期，复制组织与考核模板 | 管理员 |
| 提醒设置 | 配置企业微信填报提醒 | 管理员 |
| 操作日志 | 查看系统操作记录 | 管理员 |
| 个人中心 | 修改个人信息与密码 | 所有用户 |

## 角色体系

| 角色 | 权限范围 |
|------|----------|
| 超级管理员 | 全部功能、全部组织 |
| 管理员 | 全部功能、全部组织 |
| 大班总督/大班副督 | 本大班日程管理、本大班数据查看 |
| 班级总督察/班级副总督察 | 本班级数据查看与填报 |
| 小组督察/小组副督察 | 本小组考勤填报 |

## 部署

1. 在 Supabase SQL Editor 中按顺序执行 `supabase/` 下的迁移文件
2. 部署 Edge Functions：`supabase functions deploy admin-user && supabase functions deploy clever-endpoint`
3. 将根目录静态文件部署到 Web 服务器（Nginx / Vercel / Netlify 等）
4. 确保 `js/supabase-config.js` 中的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 正确
