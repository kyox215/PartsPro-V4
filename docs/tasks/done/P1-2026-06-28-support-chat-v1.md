# P1-2026-06-28-support-chat-v1

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260628-01

风险等级：R3

自治等级：L3

## 老板原始目标

客户登录自己的账号可以在网站悬浮窗口联系客服；员工实时收到消息，分配负责人，员工和管理层都能知道谁在负责。

## 目标

上线 PartsPro 站内文字客服 V1，让登录客户和后台员工在网站内完成咨询、回复、认领、转派和解决。

## 业务影响

提升客户咨询响应速度，减少询价、账号开通、售后和订单问题散落到外部聊天工具造成的责任不清。

## 完成定义

登录客户可从前台悬浮窗创建和回复会话；有客服权限的员工可在后台客服台实时看到队列、回复、认领、转派、解决和重开；数据库 RLS 限制客户只能看到自己的会话。

## 主责部门

订单运营部

## 协作部门

价格与客户部、平台发布部

## 工程守门代理

Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 订单运营部 |
| Approver | Hexiang Huang |
| Consulted | 价格与客户部、平台发布部 |
| Informed | 文档账本代理 |

## 涉及范围

- 页面：全站前台悬浮客服窗、后台 `support` panel
- API：`/api/support/**`、`/api/admin/support/**`
- 数据表/RPC：`support_conversations`、`support_messages`、`support_conversation_events`、客服权限
- 文档：本任务卡
- 外部系统：Supabase Realtime

## 已知事实

- 当前仓库已有未提交性能优化改动和一个 pending migration，客服实现必须保持独立。
- Supabase Realtime 已在购物车同步中使用 `postgres_changes` 和 `supabase_realtime` publication。
- 当前后台权限由 `admin_permissions`、`admin_role_template_permissions` 和 `partspro_my_permissions()` 驱动。

## 假设与未知项

- 第一版只做站内文字消息，不做附件、WhatsApp、邮件或离线 Push。
- 所有登录客户都能联系客服，包括资料未完整、待审核或停用客户。
- 浏览器通知只在后台页面打开并授权时触发。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | Supabase Migration 守门代理 | 客服表、权限、RLS、Realtime migration | 当前权限模型 | SQL 风险扫描通过 |
| WP-02 | Next.js 16 App Router 代理 | 客户和后台客服 API | WP-01 | API 权限和 payload 校验完成 |
| WP-03 | 前端体验代理 | 客户悬浮窗、后台客服台、浏览器通知 | WP-02 | 前后端流程可用 |
| WP-04 | PartsPro 业务契约代理 | 验证和交接 | WP-01..03 | lint/build 和安全门结果记录 |

## 批准要求

- 是否需要老板批准：实施已由老板要求执行；生产 migration 应用仍受安全门约束。
- 是否需要 Supabase migration 安全门：需要。
- 是否需要 Vercel 发布门：发布时需要。
- 是否需要 PartsPro 业务契约验收：需要。

## 验收标准

- 客户 A 不能读取客户 B 的会话或消息。
- 无客服权限员工无法访问后台客服 API。
- 员工认领、转派、回复、解决、重开都会产生事件并更新会话负责人和状态。
- 客户和后台能通过 Realtime 或刷新看到新消息。
- 后台打开时，新未分配消息或我的会话新客户消息触发浏览器通知。

## 禁止事项

- 不暴露 `SUPABASE_SERVICE_ROLE_KEY` 到浏览器。
- 不把客服消息做成公开表或匿名可读写表。
- 不混入当前未提交性能优化 migration。
- 不自动接入 WhatsApp、邮件或文件上传。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db query --linked "<targeted smoke SQL>"
vercel env ls production
vercel redeploy parts-pro-v4-a6kjssf0j-kyox120-9295s-projects.vercel.app --target production
node --input-type=module <support-e2e-smoke>
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无空白错误 |
| `npm run lint` | pass | ESLint 通过 |
| `npm run build` | pass | Next.js build 和 TypeScript 通过；新增 support API 出现在 route manifest |
| contract scan | pass | 扫描到 38 张表，包含 `support_conversations`、`support_messages`、`support_conversation_events` |
| SQL risk scan | review required | 本次 migration 涉及 grant/revoke、RLS policy、private security definer 辅助函数；无 drop/truncate/数据回填 |
| `supabase db push --linked --dry-run` | pass with hold | dry-run 只显示 `20260628003335_support_conversations_v1.sql` |
| `supabase migration list --linked` | pass | `20260628003335` 已显示在 Local 和 Remote；无 remote-only divergence |
| `supabase db push --linked` | pass | 已应用 `20260628003335_support_conversations_v1.sql` 到 `yiuxrjqexlfjtxxrkqvi / PartsPro-V4` |
| support table smoke query | pass | 3 张 support 表存在，RLS 已启用，replica identity 为 full |
| support policy smoke query | pass | 3 条 select policy 存在：conversation、message、event |
| support permission smoke query | pass | `panel.support` 和 4 个 `support.*` 权限存在；`admin`、`sales`、`sales_support` 各有 5 个客服权限 |
| Realtime publication smoke query | pass | 3 张 support 表已加入 `supabase_realtime` publication |
| security definer ACL smoke query | pass | `private.support_can_read_conversation` 位于 `private` schema，ACL 为 `postgres` 和 `authenticated`，未公开给 `public` |
| `supabase db advisors --linked --type security --level warn --fail-on none` | pass with existing warnings | 未发现本次新增 support 函数告警；输出包含项目历史 `function_search_path_mutable` 和 public security-definer RPC 告警 |
| production anonymous API smoke | pass | `GET /api/support/conversations/current` 返回 401 `SUPPORT_LOGIN_REQUIRED`；`GET /api/admin/support/conversations` 返回 401 `ADMIN_FORBIDDEN`，无 5xx |
| Vercel production env check | fixed | Production 最初缺少 server-only `SUPABASE_SERVICE_ROLE_KEY`；已添加 encrypted env var，未暴露密钥值 |
| Vercel production redeploy | pass | 重部署 latest Git deployment `9651048`，新 production URL `parts-pro-v4-fsyz8b94m-kyox120-9295s-projects.vercel.app` 已 alias 到 `https://www.partspro.app` |
| production login E2E support smoke | pass | Run `20260628102755`：4 个临时用户；客户发起消息；support A 认领/回复；转派 support B；support B 回复；解决/重开/最终解决；`messageCount=3`，`eventCount=9` |
| customer isolation smoke | pass | Run `20260628102755`：customer B 跨客户读取被 404 `SUPPORT_CONVERSATION_NOT_FOUND` 阻止；customer B 当前会话为空；匿名客户/后台 API 仍返回 401 |
| temporary test data cleanup | pass | Run `20260628102755`：targeted cleanup SQL 已删除临时 support rows、auth users、profiles 和 customers |

## 执行记录

- 创建：2026-06-28
- 批准：老板要求 “Implement the proposed plan.”
- 开始：2026-06-28
- review：2026-06-28，本地实现和 build 通过；生产 migration 因安全门未自动应用。
- verified：2026-06-28，migration list、schema/RLS/permission/Realtime/security-definer ACL、production anonymous API smoke 均通过。
- released：2026-06-28，生产 Supabase migration 已应用；GitHub `origin/main` 已包含代码提交 `f9493a1`。
- closed：2026-06-28，生产 Vercel env 修复并重部署后，登录态客服端到端验收通过，测试账号和测试数据已清理。

## 结果

已完成代码推送、生产数据库上线、Vercel Production 环境变量修复和 production redeploy：新增客服 schema migration、服务端 API、客户悬浮窗、后台客服台、权限映射、Realtime 订阅和浏览器通知入口。生产 Supabase migration 已在批准后应用；匿名线上 API smoke 和登录态端到端客服流程均已通过。任务关闭。
