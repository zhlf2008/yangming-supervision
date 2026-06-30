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
| 007 | `20260510_001_rls_business_tables.sql` | semesters/assessment_types/schedules/attendance_records/feedback 补 RLS | 待执行 |
| 008 | `20260511_001_fix_profiles_rls.sql` | 修复 profiles RLS 递归问题 | 待执行 |
| 009 | `20260511_002_fix_reminder_configs_rls.sql` | 修复 reminder_configs RLS | 待执行 |
| 010 | `20260512_002_org_editable_flag.sql` | organizations 添加 editable 标记 | 待执行 |
| 011 | `20260512_merge_duplicate_groups.sql` | 合并重复小组数据 | 待执行 |
| 012 | `20260516_001_org_soft_delete.sql` | organizations 软删除支持 | 待执行 |
| 013 | `20260516_002_org_archived_at.sql` | organizations 归档时间戳 | 待执行 |
| 014 | `20260523_001_deadline_configs.sql` | 考核项目截止规则表 | 待执行 |
| 015 | `20260523_002_award_notification.sql` | 获奖推送通知表 | 待执行 |
| 016 | `20260523_003_section_submit_times.sql` | section 级别提交时间/提交人 + 截止规则多选星期 | 2026-05-23 |
| 017 | `20260604_001_module_memberships.sql` | 平台模块身份表 + 老账号迁移为 supervision 身份 | 2026-06-04 |
| 018 | `20260604_002_people_foundation.sql` | 秘书处基础：people、person_org_assignments、person_positions | 2026-06-04 |
| 019 | `20260604_003_study_foundation.sql` | 学委基础：study_course_library、study_schedule_rules、study_schedule_instances | 2026-06-04 |
| 020 | `20260604_004_study_assignment.sql` | 学委摊派：study_assignment_demands、study_assignment_people | 2026-06-04 |
| 021 | `20260607_001_module_memberships_semester_id.sql` | module_memberships 加 semester_id，实现模块权限按学期隔离 | 2026-06-11 |
| 022 | `20260608_001_semesters_effective_at.sql` | semesters 加 effective_at，支持未来学期自动切换为当前学期 | 2026-06-11 |
| 023 | `20260609_001_audit_logs_platform.sql` | audit_logs 加 module_key 和 semester_id，支持平台化审计筛选 | 2026-06-11 |
| 024 | `20260610_001_entry_forms.sql` | 进班表单表 entry_forms，记录学员入学信息 | 2026-06-11 |
| 025 | `20260610_002_entry_forms_v2.sql` | entry_forms 字段优化：生日历法、省市县地址、职业分类、学员类型 | 2026-06-11 |
| 026 | `20260610_003_entry_forms_phone.sql` | entry_forms 加手机号字段 phone | 2026-06-11 |
| 027 | `20260611000002_anon_insert_entry_forms.sql` | 允许匿名用户提交进班表单（外部填写） | 2026-06-11 |
| 028 | `20260611000003_grant_anon_insert.sql` | GRANT INSERT ON entry_forms TO anon | 2026-06-11 |
| 029 | `20260619000001_backfill_audit_logs_supervision.sql` | 回填历史空 module_key 审计日志为督察管理 | 2026-06-25 |
| 030 | `20260620090624_20260620000001_harden_permissions_rls.sql` | 加固 Edge Function/RLS 权限边界，统一模块权限语义 | 2026-06-20 |
| 031 | `20260625000001_optimize_entry_forms_pending.sql` | 优化人员管理待处理进班申请列表查询索引 | 2026-06-25 |
| 032 | `20260625102913_study_workflow_v2.sql` | 学委工作流 v2：大班规则、组织节点日程、内容继承、岗位表与摊派增强 | 2026-06-25 |
| 033 | `20260625121436_study_schedule_backfill_org_nodes.sql` | 回填旧全局学委规则到各大班，并补齐各组织节点日程实例 | 2026-06-25 |
| 034 | `20260625124125_study_schedule_prune_stale_instances.sql` | 清理与当前大班规则不匹配且无内容/岗位绑定的历史日程实例 | 2026-06-25 |
| 035 | `20260629065350_add_study_notification_templates.sql` | 新增各级组织通知排版模板及学委权限策略 | 2026-06-29 |
| 036 | `20260629111652_study_workflow_v3.sql` | 学委工作流 v3：日程多课程、共读类型岗位人数与启停模板 | 2026-06-29 |
| 037 | `20260629112035_study_workflow_v3_content_order_fix.sql` | 允许同一日程的多门课程使用相同排序值 | 2026-06-29 |
| 038 | `20260629114523_study_workflow_v4.sql` | 学委工作流 v4：可维护共读类型、类型岗位与逐级名额槽位 | 2026-06-29 |
| 039 | `20260630053455_restrict_person_position_scopes.sql` | 按秘书处所属组织级别限制人员职务写入范围 | 2026-06-30 |
| 040 | `20260630060948_normalize_person_position_scopes.sql` | 归一化历史人员职务级别与所属组织级别 | 2026-06-30 |
| fix | `20260613_001_migrate_profiles_to_people_assignments.sql` | 旧 profiles 账号同步为 people，并迁移 organization_id 到当前学期人员归属 | 2026-06-13 |

## 开发诊断

`supabase/dev/` 目录存放一次性诊断脚本，不属于正式迁移序列。

## 新增迁移规范

- 文件命名：`YYYYMMDD_NNN_描述.sql`（NNN 为当天序号，从 001 起）
- 每个迁移必须是**可重复执行**的（使用 `IF NOT EXISTS`、`DROP ... IF EXISTS` 等）
- 执行后更新本文件，记录序号、说明、执行时间
