# 工作目录整理

## 1. supabase/ 目录整理
将根目录的 SQL 迁移文件按用途归入子目录，消除与 `migrations/` 的重复。

### 分类规则
- `supabase/schema/` — 建表、DDL 结构
- `supabase/rls/` — RLS 策略
- `supabase/fix/` — 修复脚本
- `supabase/data/` — 数据迁移
- `supabase/dev/` → 删除（1 个诊断 SQL，内容不重要）

### 文件映射

| 原文件 | 目标 |
|--------|------|
| 20250427_001_init_tables.sql | schema/ |
| 20250427_002_reminder_and_audit.sql | schema/ |
| 20250508_003_semester_isolation.sql | schema/ |
| 20250508_004_schedules_per_daban.sql | schema/ |
| 20260604_001_module_memberships.sql | schema/ |
| 20260604_002_people_foundation.sql | schema/ |
| 20260604_003_study_foundation.sql | schema/ |
| 20260604_004_study_assignment.sql | schema/ |
| 20260605_001_study_courses.sql | schema/ |
| 20260605_001_zhiliangzhi_course.sql | schema/ |
| 20260606_001_study_courses_v2.sql | schema/ |
| 20250508_001_rls_orgs_profiles.sql | rls/ |
| 20260510_001_rls_business_tables.sql | rls/ |
| 20260511_001_fix_profiles_rls.sql | rls/ |
| 20260511_002_fix_reminder_configs_rls.sql | rls/ |
| 20250508_002_role_rename.sql | fix/ |
| 20260512_002_org_editable_flag.sql | fix/ |
| 20260512_merge_duplicate_groups.sql | fix/ |
| 20260516_001_org_soft_delete.sql | fix/ |
| 20260516_002_org_archived_at.sql | fix/ |
| 20260523_001_deadline_configs.sql | fix/ |
| 20260523_002_award_notification.sql | fix/ |
| 20260523_003_section_submit_times.sql | fix/ |
| supabase/dev/diagnose_reminder.sql | 删除 |
| supabase/migrations/20260*.sql | 移到 data/ |
| supabase/.temp/ | 保留（Supabase CLI 自动生成） |

## 2. 根目录杂物
- `_headers` — 保留，部署配置需要
- `skills-lock.json` — 保留，ECC 技能锁文件

## 3. HTML 文件
不动。根目录摊着虽然多，但移动需要改 20+ 个文件的路径引用，风险大于收益。
