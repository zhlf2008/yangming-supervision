# 会话快照：2026-06-05

> 保存于上下文届满前，用于新会话快速恢复。

## 项目定位

阳明心学班级管理平台。原为单一督察管理系统，现扩展为多模块平台：
**平台入口 → 督察模块 / 秘书处模块 / 学委模块**

---

## 代码变更总览（本会话新增）

```
docs/platform-modularization-plan.md   # 完整规划文档
portal.html                             # 平台入口页面
login.html                              # 修改：登录分流
index.html                              # 修改：管理员可见切换模块

supabase/
  20260604_001_module_memberships.sql   # 模块身份表
  20260604_002_people_foundation.sql    # 人员基础表
  20260604_003_study_foundation.sql     # 学委基础表
  20260604_004_study_assignment.sql     # 学委摊派表

secretariat-dashboard.html              # 秘书处首页
secretariat-semesters.html              # 学期管理
secretariat-org-management.html        # 组织架构（含排序）
secretariat-people.html                 # 人员管理（含归属/职务/权限）
secretariat-org-assignment.html         # 已删除，合并到人员管理
secretariat-positions.html              # 已删除，合并到人员管理
secretariat-accounts.html               # 已删除，合并到人员管理

study-dashboard.html                    # 学委首页
study-course-library.html               # 课程内容库
study-schedule-rules.html               # 日程规则 + 日程生成
study-weekly-assignment.html            # 每周安排 + 摊派 + 排班表

profile.html                            # 修改：小组督察统计按小组查
```

---

## 当前进度

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 保存完整规划 | ✅ |
| 1 | 平台入口与登录分流 | ✅ |
| 2 | 模块身份表 + 人员基础表 | ✅ |
| 3 | 学委课程库与日程规则 | ✅ |
| 4 | 学委周计划与摊派 | ✅ |
| 4b | 秘书处完善 | ✅ |
| 5 | 企业微信自动推送 | ⬜ 待开发 |
| 6 | 优秀作业展示卡片 | ⬜ 待开发 |

---

## 关键架构决策

1. **一套账号，多模块身份**。`module_memberships` 表负责，不修改 `profiles.role`
2. **老督察账号迁移**：114 个 profiles 已迁移为 supervision 模块身份
3. **登录分流**：管理员 → `portal.html`，普通督察 → `index.html`
4. **人员主数据**：`people` 表管理，学委通过 `person_org_assignments` 调用
5. **不碰督察现有文件**：所有新增页面独立运行，不影响督察模块

---

## 学委数据模型

```
study_course_library       课程内容库
study_schedule_rules       日程规则（周几=什么层级）
study_schedule_instances   按规则生成的具体日程
study_assignment_demands   岗位摊派（大班→班级→小组）
study_assignment_people    最终人员落位
```

---

## 秘书处数据模型

```
people                     人员档案
person_org_assignments     学期组织归属
person_positions           职务
module_memberships         模块权限
```

---

## 当前确认的产品决策

- 平台入口使用 `portal.html`
- 学委模块文件前缀使用 `study-*`
- 普通老督察直接进督察系统，不显示模块选择
- 学委日程支持大班/班级/小组三个层级
- 提前一周排班（本周一安排下周，周三公示）
- 人员安排支持从成员名单选人或手填姓名
- 第一阶段只生成通知文案，不自动推送
- 课程内容全局维护，日程可引用也可手填
- 职务管理、模块权限合并到人员管理一站式编辑

---

## 待开发 Phase 5 要点

1. 企业微信群通知配置页面（参考 reminder-settings.html）
2. Edge Function `study-notification`（参考 clever-endpoint）
3. 通知日志表 `study_notice_logs`
4. 幂等推送机制（同一班级同一天不重复推送）
5. 排班表图片生成（参考 weekly-awards.js）
6. 优秀作业收集与卡片展示

---

## 最近 git 提交

```text
838c8f0 docs: 更新规划文件为当前实施状态
ef75b46 fix: 去掉组织名后括号标注，+改为添加
88703ba fix: 组织按 sort_order + 名称排序
b589caf refactor: 删除独立职务/权限页面，合并到人员管理
0d93936 feat: 人员管理重构，包含组织归属/职务/权限；组织架构排序
69dc92f feat: 人员管理增加组织架构树
d0b5b38 feat: 秘书处学期管理与组织架构管理
bda049b feat: Phase 4 学委周计划与岗位摊派
2ee5580 feat: Phase 3 学委课程库与日程规则
f86ad5c feat: 秘书处完整模块
be5db49 feat: Phase 2 人员基础表
5794986 feat: Phase 2 模块身份表 module_memberships
33dca67 feat: Phase 1 平台入口与登录分流
```
