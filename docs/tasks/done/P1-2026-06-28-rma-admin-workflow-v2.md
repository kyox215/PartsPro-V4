# P1-2026-06-28-rma-admin-workflow-v2

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260628-02

风险等级：R3

自治等级：L3

## 老板原始目标

Implement the proposed plan. 售后闭环补齐中优先做 `退款 + 库存`，在已实现的 RMA v2 基础上推进 `RMA 售后闭环 2.1`。

## 目标

把现有客户售后申请从“后台可记录状态”升级为“后台能分配负责人、创建钱包退款申请、标记退货收货、回补库存或标记报废，并让客户可追踪处理结果”的闭环。

## 业务影响

售后直接影响客户信任、订单责任归属、退款/换货和库存回补判断。当前客户侧已能选择订单和商品提交，但后台缺少集中处理台和结构化处理记录。

## 完成定义

客户可以提交售后申请并看到后台处理状态、处理备注、处理时间；后台员工可以按状态和队列筛选售后申请，查看订单/商品/客户上下文，并执行状态流转、负责人分配、钱包退款申请、退货收货、库存回补、报废和关闭。数据库记录处理人、检测结果、处理备注、退款金额、钱包退款申请 ID、库存处置、事件历史和附件元数据。

## 主责部门

订单运营部

## 协作部门

仓库库存部、价格与客户部、平台发布部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、前端体验代理

## 涉及范围

- 页面：客户 `/rma`、后台 `RMA` panel
- API：`/api/rma`、`/api/admin/rma`、`/api/admin/rma/[requestId]`、`/api/admin/rma/[requestId]/actions`
- 数据表：`rma_requests`、`rma_request_events`、关联 `wallet_refund_requests`
- 权限：新增 `rma.read`、`rma.manage`、`rma.refund`、`rma.inventory`；兼容 `orders.read`、`orders.manage`、`wallet_refunds.request`、`product.adjust_stock`
- 文档：本任务卡

## 已知事实

- 当前客户侧 RMA 已能选择订单和订单行提交，且服务端校验订单行归属和剩余数量。
- 当前附件只是本地选择提示，没有真实上传。
- 现有 RLS 已允许 staff 读取/更新 `rma_requests`，客户读取主要按 `user_id`。
- 多账号共享同一客户时，已知风险是售后累计数量应按订单行/客户上下文计算，不能只按当前 `user_id`。

## 假设与未知项

- 本次先做后台处理闭环、结构化附件元数据、钱包退款申请和库存处置，不接外部物流、邮件、WhatsApp 或现金/银行卡退款。
- 文件上传本次采用私有 Supabase Storage bucket `rma-evidence`，由服务端 API 上传并返回短期签名 URL；数据库只保存附件元数据和私有 path。
- 钱包退款仍需要后续审批才真正入账；RMA 创建退款申请后，钱包退款审批通过会自动把 RMA 标记为 `refunded`。
- 退回商品默认先进入 `quarantine`；只有后台点击回补库存才调用 `rma_return` 增加可售库存；报废只记录售后处置，不自动扣减库存。

## 验收标准

- 客户 A 不能读取客户 B 的 RMA；后台 staff 可以读取队列。
- 客户提交后，后台能看到订单号、SKU、商品、数量、客户问题、附件元数据和当前状态。
- 后台状态流转会更新 `rma_requests` 并写入 `rma_request_events`。
- 后台“创建退款申请”只创建一条关联的钱包退款申请，重复点击不会重复创建。
- 钱包退款审批通过后，RMA 自动进入 `refunded` 并写入 `refund_approved` 事件。
- 后台“已收货”会把库存处置标记为 `quarantine`；“回补库存”会调用现有库存 RPC 的 `rma_return`；“标记报废”只记录 disposition。
- 客户刷新 `/rma` 可看到后台处理备注、检测结果、退款金额和更新时间。
- 多账号共享同一客户时，剩余可申请数量按订单行已有 RMA 总量计算。
- 未登录用户访问客户/后台 RMA API 返回 401；无权限员工处理返回 403。

## 禁止事项

- 不自动创建退款入账；只创建待审批的钱包退款申请。
- 不自动库存回补；必须员工点击回补库存 action。
- 不把客户售后数据暴露给匿名或其它客户。
- 不绕过 Supabase migration 安全门。
- 不提交无关 `public/brand/` 资产。

## 验证命令

```bash
python3 /Users/kyox215/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-rma-v21-contract-scan.md --json /tmp/partspro-rma-v21-contract-scan.json
npx tsc --noEmit
git diff --check
npm run lint
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db lint --linked --schema public,private,storage --level error --fail-on error
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db advisors --linked --type security --level error --fail-on error
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| contract_scan.py | pass | `/tmp/partspro-rma-v21-contract-scan.md` / `.json` 生成成功，无阻断输出 |
| `npx tsc --noEmit` | pass | TypeScript 通过 |
| `git diff --check` | pass | 无空白错误 |
| `npm run lint` | pass | ESLint 通过 |
| `npm run build` | pass | Next.js 16 production build 通过，新增 `/api/admin/rma/[requestId]/actions` 路由进入构建清单 |
| `supabase migration list --linked` | pass | 远端与本地已应用 migration 对齐，仅 `20260628134442_rma_admin_workflow_v2` 本地待应用 |
| `supabase db push --linked --dry-run` | pass / not applied | dry-run 只会推 `20260628134442_rma_admin_workflow_v2.sql` |
| `supabase db push --linked` | pass | 已应用 `20260628134442_rma_admin_workflow_v2.sql` 到 linked 项目 |
| post-migration smoke SQL | pass | bucket=1、RMA 新字段=8、RPC=2、钱包同步 trigger=1、RMA 权限=4、事件 policies=2 |
| `supabase db lint --linked --schema public,private,storage --level error --fail-on error` | pass | 远端当前 schema 无 error 级 lint 输出；不代表未应用 migration 已解析 |
| `supabase db advisors --linked --type security --level error --fail-on error` | pass | 远端当前 security advisor error 级无问题；不代表未应用 migration 已解析 |
| local dev smoke | pass | `http://127.0.0.1:3010/admin` 返回 200；未登录 `/rma` 按预期 307 到 `/login?next=/rma` |
| Vercel production deployment | pass | `www.partspro.app` production READY，latest deployment commit `85655b700712dc24f16c53b61ed408196fdcda3f` / `Implement RMA refund and inventory closure` |
| Vercel production error logs | pass | `vercel logs --environment production --level error --since 1h --limit 20 --no-follow` 无 error log |
| production anonymous smoke | pass | `/rma` 307 -> `/login?next=/rma`；`/api/rma` 401 `LOGIN_REQUIRED`；`/api/admin/rma` 401 `ADMIN_FORBIDDEN` |
| production migration confirmation | pass / degraded command | `supabase migration list --linked` 当前因 CLI DB password auth 失败不可用；通过 `supabase_migrations.schema_migrations` 查询确认 `20260628003335` 与 `20260628134442` 已在远端 |
| production customer RMA smoke | pass | run `rma-customer-smoke-20260628182833-6889f3`：临时客户资料补全、现有 SKU `3000000105689` 订单候选、附件上传、RMA `01fb2b85-fa04-440e-9310-008993e27f3b` 提交、客户隔离、普通客户 admin API 403、测试数据清理 remaining=0 |
| production admin RMA E2E | pass | 老板批准方案 2 后执行 run `rma-admin-e2e-20260628185347-975580`：临时 admin 授权、临时 SKU `RMA-E2E-20260628185347-975580`、RMA `a27e9bb6-7bd9-4da0-9b85-9406ce7c7d3a`、wallet refund `1b3cba9b-66d4-468e-85ed-91dc4c226011`；提交、队列、分配、审批、收货 quarantine、钱包退款申请幂等、回补库存、审批钱包退款、关闭、客户可见 closed、事件 9 条、wallet credit transaction `1c84aff2-046f-4d89-84ba-c4fbcd02e696` 全部通过 |
| production cleanup after admin E2E | pass | 测试数据清理 `remaining={"rma":0,"refund":0,"order":0,"product":0,"inventory":0,"customers":0,"profiles":0}`，`errors={}` |
| Vercel production error logs after admin E2E | pass | `vercel logs --environment production --level error --since 30m --limit 20 --no-follow` 无 error log |

## 执行记录

- 创建：2026-06-28
- 开始：2026-06-28
- verified：2026-06-28，RMA v2 本地类型检查、lint、build、Supabase dry-run 通过
- expanded：2026-06-28，增加 RMA v2.1 退款申请、库存处置、负责人、队列筛选和 action API
- verified：2026-06-28，RMA v2.1 本地类型检查、lint、build、Supabase dry-run、远端当前 schema lint/advisor error 级检查和 dev smoke 通过
- migration_applied：2026-06-28，linked Supabase 项目已应用 `20260628134442_rma_admin_workflow_v2.sql`，post-migration smoke SQL 通过
- released：2026-06-28，生产 Vercel deployment READY，`www.partspro.app` 指向 commit `85655b700712dc24f16c53b61ed408196fdcda3f`
- production_customer_smoke：2026-06-28，客户侧 RMA smoke 通过并清理临时数据
- approved：2026-06-28，老板选择方案 2，批准临时 admin 授权方式执行生产完整 E2E
- production_admin_e2e：2026-06-28，完整管理员闭环 E2E 通过并清理临时数据
- closed：2026-06-28

## 结果

代码和 migration 已实现、推送并在生产 Vercel READY；linked Supabase migration 已确认应用。客户侧生产 smoke 与管理员端完整闭环 E2E 均已通过：客户提交 RMA、附件上传、后台队列、负责人分配、审批、收货 quarantine、钱包退款申请幂等、库存回补、钱包退款审批、关闭、客户可见状态、事件历史和临时数据清理均完成。任务关闭。
