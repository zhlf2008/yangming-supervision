# 数据库迁移记录

按序号递增顺序执行，每个文件在 Supabase SQL Editor 中运行一次。

## 执行顺序

| 序号 | 文件名 | 说明 | 执行时间 |
|------|--------|------|----------|
| 001 | `20250427_001_init_tables.sql` | 初始约束：考勤唯一索引、日程唯一索引 | 2025-04-27 |
| 002 | `20250427_002_reminder_and_audit.sql` | 提醒配置表、操作日志表及 RLS | 2025-04-27 |
| 003 | `20250508_001_rls_orgs_profiles.sql` | organizations/profiles 表 RLS 策略 + reminder_configs RLS 修复 | 2025-05-08 |
| 004 | `20250508_002_role_rename.sql` | 角色重命名（管理员→超级管理员，地区督委→管理员）+ RLS 策略更新 | 2025-05-08 |
| 005 | `20250508_003_semester_isolation.sql` | organizations 和 assessment_types 添加 semester_id | 2025-05-08 |
| 006 | `20250508_004_schedules_per_daban.sql` | schedules 添加 org_id，按大班隔离日程 | 2025-05-08 |

## 开发诊断

`supabase/dev/` 目录存放一次性诊断脚本，不属于正式迁移序列。

## 新增迁移规范

- 文件命名：`YYYYMMDD_NNN_描述.sql`（NNN 为当天序号，从 001 起）
- 每个迁移必须是**可重复执行**的（使用 `IF NOT EXISTS`、`DROP ... IF EXISTS` 等）
- 执行后更新本文件，记录序号、说明、执行时间
