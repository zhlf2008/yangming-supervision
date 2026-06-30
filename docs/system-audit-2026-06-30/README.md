# 全系统审查报告

日期：2026-06-30

## 审查范围

- 平台入口、秘书处、督察、学委三个模块的核心页面
- 人员管理、待处理申请、进班表单、考勤填报、日程规则、组织日程
- 移动窄屏下的布局、加载状态、表单语义和导航一致性
- 前端代码、部署响应头、Supabase RLS、Edge Functions 和数据库顾问

审查阶段未进行破坏性写入；随后已根据审查结果完成代码整改和生产数据库迁移。

## 结论

系统的模块划分清楚，移动端主路径基本可用，视觉风格也较统一。审查发现的 P0 权限绕过与证书 HTML 注入已修复；公共表单、图标、无障碍、加载体验和索引也已完成第一轮整改。

## 整改结果

- 已删除 7 张表的遗留全开放 RLS，收紧 `anon` / `authenticated` grants，并限制未来表的默认权限。
- 已修复证书 URL 参数 HTML 注入，对文本和印章参数执行安全输出与格式校验。
- 已部署 `entry-form-submit` Edge Function；公开提交具备字段、手机号、学期、组织、蜜罐和时间窗口校验。
- 已加入 CSP、`nosniff`、Referrer Policy、Permissions Policy 和点击劫持防护响应头。
- 已通过 better-icons MCP 同步统一的 Lucide 图标集到 `src/icons`，替换高频 Emoji、文字符号和手写 UI 图标。
- 已补充通用表单标签关联、对话框语义、键盘焦点、减少动态效果偏好和主入口加载状态。
- 督察首页已改为异常优先、最多 12 组，并补齐热点外键索引迁移。
- 审查截图仅保留在本机并由 `.gitignore` 排除，避免生产个人信息进入仓库。

仍需在 Supabase 控制台手动开启 Auth 的 Leaked Password Protection；现有 28 个页面的内联脚本也应在后续拆分后进一步收紧 CSP，移除 `unsafe-inline`。

## 主要优点

1. 平台、秘书处、督察、学委的边界和入口较清楚，底部导航在各模块内保持一致。
2. 546px 窄屏抽查中，多数页面没有页面级横向滚动，卡片与主要操作能正常重排。
3. 考勤页把组织、日期、填报人和已提交状态放在操作前，降低了填错范围的风险。
4. `admin-user` Edge Function 会服务端校验调用者和组织范围，没有只依赖前端按钮隐藏。
5. `npm run lint` 通过：28 个 HTML、9 个 JS，0 错误、0 警告。

## P0：立即处理

### 1. 线上 RLS 被 7 条全开放策略绕过

Supabase Security Advisor 和只读 SQL 均确认，以下表存在 `TO public / FOR ALL / USING (true) / WITH CHECK (true)`：

- `areas`
- `assessment_types`
- `attendance_records`
- `organizations`
- `profiles`
- `schedules`
- `semesters`

同时，`anon` 对这些表拥有 `SELECT/INSERT/UPDATE/DELETE` 等完整权限。前端权限拦截和后续精细 RLS 会被这些 permissive policy 直接放行。风险包括匿名读取人员资料、篡改组织/学期/考勤和删除业务数据。

仓库中的加固迁移只删除了已知中文策略，没有删除线上遗留的英文 `Allow all access to ...` 策略：

- `supabase/migrations/20260620090624_20260620000001_harden_permissions_rls.sql:132`

建议：

1. 立即新增幂等迁移，显式删除 7 条英文策略。
2. 撤销 `anon` 的写权限，只按真实公共读取/提交需求重新 `GRANT`。
3. 用 anon、普通成员、各模块角色、管理员五类账号做 CRUD 权限矩阵回归。
4. 检查近期审计日志和异常数据，确认是否已有未授权改写。
5. 把 Security Advisor 设为部署门禁，避免数据库状态再次漂移。

参考：[Supabase RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)、[permissive RLS 修复说明](https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy)

### 2. 证书页可由 URL 参数注入 HTML

`certificate-render.html:234` 把 URL 的 `context` 参数直接写入 `innerHTML`；`sealName` 也在 `certificate-render.html:275` 拼入 HTML。审查用无脚本标记验证后，页面确实创建了攻击者提供的 DOM 节点。

该页面与系统同源，而 Supabase 会话默认持久化在浏览器存储中，因此这不是单纯的排版问题，可能升级为同源脚本执行和会话窃取。

建议：

1. `context`、`sealName` 全部改为 `textContent` 或 DOM API。
2. 如确实需要富文本，使用严格白名单净化器并禁止事件属性、URL 和样式注入。
3. 增加 CSP、`X-Content-Type-Options`、`Referrer-Policy`、frame 限制等响应头；当前 `_headers` 只有缓存配置。
4. 添加 URL 参数注入回归测试。

证据：[12-certificate-html-injection.png](12-certificate-html-injection.png)

## P1：本周完成

### 3. 公共进班表单容易被绕过验证码批量灌入

验证码和“已提交”限制都在浏览器端；匿名调用者可以直接调用 Supabase REST 插入 `entry_forms`。当前 RLS 只约束 `person_id` 和 `status`，没有服务端验证码、频率限制、字段长度、手机号格式、目标学期/组织有效性校验。

建议撤销 `anon` 对表的直接插入，改为 Edge Function：服务端验证验证码、限流、校验学期和组织、规范化字段后再用受控权限写入。

相关代码：

- `secretariat-entry-form.html:1050`
- `supabase/migrations/20260620090624_20260620000001_harden_permissions_rls.sql:149`

### 4. 缺少关键安全响应头

`_headers` 仅设置缓存。结合当前内联脚本和已确认的注入入口，缺少 CSP 会放大风险。

建议先加入 `frame-ancestors`、`object-src 'none'`、`base-uri 'self'`、`X-Content-Type-Options: nosniff`、严格 `Referrer-Policy`；随后把 28 个页面的内联脚本迁出，再收紧 `script-src`，避免长期依赖 `unsafe-inline`。

### 5. Edge Function 依赖未固定精确版本

三个 Edge Function 使用 `@supabase/supabase-js@2`，`award-notification` 的 `md5`、`pinyin-pro` 甚至没有版本。建议固定精确版本并维护 `deno.json`/lockfile，降低供应链更新导致生产行为漂移的风险。

正面项：`clever-endpoint` 和 `award-notification` 虽使用 `--no-verify-jwt`，代码内已实现 cron secret 或管理员 JWT 校验。

## P2：两周内完成

### 6. 全系统图标不符合既定规范

导航、入口卡片、空状态、按钮和表单选项大量使用 Emoji；周切换还使用 `◀/▶` 文字符号，日程规则内存在手写 data-URI SVG。

集中入口在 `js/components.js:47-123`。建议一次性通过 better-icons MCP 批量获取 Lucide 图标，落到 `src/icons`，先替换共享导航，再替换页面级图标，避免逐页形成新分叉。

### 7. 表单标签看得见，但程序无法关联

多个页面的 `<label>` 没有 `for`，输入框也没有 `aria-labelledby`。考勤数字输入在无障碍树中的名称变成了占位符“0”；进班表单的省、市、区和行业选择框也没有可编程名称。

相关位置：

- `attendance-page.html:1175-1183`
- `secretariat-entry-form.html:228-265`

建议建立共享字段渲染器，强制生成稳定 `id`、`for`、错误提示关联和必填状态；补做键盘、焦点、读屏和 200% 缩放测试。

### 8. 首屏存在明显的异步内容闪烁

平台入口和督察首页先显示“加载中...”及问号头像，约 0.8-2.7 秒后才替换为用户、学期和模块内容。首拍证据因此被作废并重拍。

建议在认证、当前学期、模块权限完成前显示稳定骨架；把页面初始化收口为一个 bootstrap Promise，失败时给出可重试错误态，不要让真实布局先以占位内容出现。

### 9. 督察首页信息量过大，缺少异常优先级

“今日概况”一次渲染所有小组，DOM 和无障碍树包含大量重复指标。用户真正需要的是低于阈值、未填报和临近截止的小组。

建议首页默认展示异常和待办，完整列表放到可筛选的二级页；数据库侧做聚合 RPC，前端分页或虚拟化。Performance Advisor 同时报告多项未索引外键和重复 permissive policy，应按真实查询计划补索引、合并策略。

### 10. 单文件体积已经影响维护和测试

所有 28 个 HTML 都含内联脚本；最大文件：

- `secretariat-people.html`：2698 行
- `summary-page.html`：2066 行
- `study-org-schedule.html`：1820 行
- `attendance-page.html`：1692 行

建议按“页面控制器 + 数据服务 + 共享渲染组件”拆分，优先拆人员管理、组织日程和考勤；为权限守卫、RLS 角色矩阵、表单校验和日期/周次算法补单元与端到端测试。

## 审查步骤

1. `01-secretariat-dashboard.png`：秘书处工作台。健康度：一般。入口清楚，但卡片与底部导航依赖 Emoji，宽屏截图还出现内容被右侧裁切。
2. `02-secretariat-org-management.png`：组织架构。健康度：一般。层级和操作明确，但窄容器下统计区有裁切风险。
3. `03-secretariat-people.png`：人员管理。健康度：较好。关键数量和组织入口清晰，移动端布局稳定。
4. `04-pending-entry-requests.png`：待处理申请。健康度：较好。信息密度合适，但同一弹层有两个同名“关闭”按钮，读屏定位不够明确。
5. `05-entry-form.png`：进班表单。健康度：一般。步骤分组清晰，但表单很长、Emoji 密集，标签语义不完整。
6. `06-portal.png`：平台入口。健康度：较好。模块边界明确，但初始加载闪烁明显。
7. `07-supervision-dashboard.png`：督察首页。健康度：一般。快捷入口清楚，今日概况缺少异常优先和结果收敛。
8. `08-attendance.png`：考勤填报。健康度：较好。业务上下文充分，但输入框无可编程标签，“已提交”仍是启用按钮，状态与动作含义不够明确。
9. `09-study-dashboard.png`：学委首页。健康度：较好。三条主路径清楚；“通知与推送”以不可操作卡片出现，容易被误认为可点击。
10. `10-study-schedule-rules.png`：日程规则。健康度：较好。规则表和开关易扫读，但选择框标签、图标来源和周切换控件需要规范化。
11. `11-study-org-schedule.png`：组织日程。健康度：一般。组织下钻合理，但页面截图出现左侧裁切，生成排班等高影响动作缺少结果预览说明。
12. `12-certificate-html-injection.png`：证书参数注入验证。健康度：危险。无脚本 HTML 标记已能由 URL 参数创建为真实 DOM。

## 建议执行顺序

1. 立即修复线上全开放 RLS 和 anon grants，并完成权限矩阵回归。
2. 修复证书页注入，补安全响应头。
3. 将公共进班提交迁到有验证码和限流的 Edge Function。
4. 通过 better-icons MCP 统一替换共享导航和高频页面图标。
5. 修复共享表单语义、焦点和错误提示。
6. 收口异步 bootstrap、异常优先首页和数据库索引。
7. 拆分三个最大页面并建立自动化测试门禁。

## 证据限制

- 本次使用超级管理员已登录状态，没有覆盖普通成员、秘书处、学委、督察各级角色的真实可见范围。
- 未进行破坏性写入测试；数据库风险通过 Security Advisor、系统目录和 grants 的只读查询确认。
- 截图和 DOM 检查不能证明完整 WCAG 合规，仍需键盘、读屏、对比度、缩放和错误恢复专项测试。
- 未审查企业微信实际推送链路、第三方 cron 配置和生产 CDN 是否完整应用 `_headers`。
