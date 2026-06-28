# P1-2026-06-28-support-chat-v1

状态：review

看板目录：now

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
| `supabase migration list --linked` | blocked | 远端数据库密码认证失败：`password authentication failed for user "cli_login_postgres"` |
| `npm run lint` |  |  |
| `npm run build` |  |  |

## 执行记录

- 创建：2026-06-28
- 批准：老板要求 “Implement the proposed plan.”
- 开始：2026-06-28
- review：2026-06-28，本地实现和 build 通过；生产 migration 因安全门未自动应用。
- verified：
- released：
- closed：

## 结果

本地实现完成：新增客服 schema migration、服务端 API、客户悬浮窗、后台客服台、权限映射、Realtime 订阅和浏览器通知入口。生产 Supabase migration 未自动应用，原因是 linked migration list 认证失败且本次 SQL 涉及 RLS/权限变更，按护栏需要人工确认后再推库。
