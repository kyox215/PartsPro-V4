# P1-2026-07-01-admin-finance-ledger

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260701-01

风险等级：R4

自治等级：L2

## 老板原始目标

PLEASE IMPLEMENT THIS PLAN: 在 `/admin` 增加独立 `财务` 面板，默认按“经营净额”展示销售净额、进货净成本、毛利、毛利率、库存成本价值、待收款、应付供应商、费用账本和导出。售出商品必须追溯到进货批次/成本层，历史无法精确追溯的数据标记为 `estimated` 或 `unmatched`。

## 目标

为 PartsPro 后台交付首版财务统计与完整经营账本：建立成本层、订单售出成本快照、费用账本、供应商付款记录、权限控制、API、导出和后台 UI。

## 业务影响

影响后台经营利润判断、进货成本核算、订单毛利、库存成本价值、供应商应付、手动费用登记、财务导出、权限边界和审计追踪。

## 完成定义

`/admin?panel=finance` 可按权限进入财务面板，API 能返回汇总、账本、COGS 和导出，新增费用和供应商付款会写入 Supabase 并审计，migration dry-run 只包含本任务迁移，`git diff --check`、`npm run lint`、`npm run build` 完成或记录阻塞原因。

## 主责部门

总调度/项目经理

## 协作部门

采购到货部、订单运营部、仓库库存部、价格与客户部、平台发布部

## 工程守门代理

PartsPro 业务契约代理、Supabase Migration 守门代理、Supabase RLS/权限代理、Next.js 16 App Router 代理、前端体验代理、安全审查

## RACI

| Role | Owner |
|---|---|
| Responsible | 总调度/项目经理 |
| Approver | Hexiang Huang |
| Consulted | 采购到货部、订单运营部、仓库库存部、价格与客户部 |
| Informed | 平台发布部、文档审计部 |

## 涉及范围

- 页面：`/admin?panel=finance`
- API：`/api/admin/finance/summary`、`/api/admin/finance/ledger`、`/api/admin/finance/cogs`、`/api/admin/finance/export`、`/api/admin/finance/expenses`、`/api/admin/finance/supplier-payments`
- 数据表/RPC：`finance_cost_layers`、`finance_order_line_cost_allocations`、`finance_expense_entries`、`supplier_batch_payments`、`admin_permissions`、`admin_role_template_permissions`、`admin_audit_events`
- 文档：本任务卡、migration 注释
- 外部系统：Supabase linked project `yiuxrjqexlfjtxxrkqvi / PartsPro-V4`、Vercel 发布门

## 已知事实

- 现有供应商批次数据在 `supplier_batches`、`supplier_batch_lines`。
- 现有订单行有 `batch_code`、`reserved_qty`、`fulfilled_qty`、`reservation_allocations`、`cancelled_qty`。
- `private.partspro_has_permission()` 当前通过 `admin_permissions`、角色模板和用户覆盖计算有效权限。
- 当前工作区已有未提交改动：`src/components/partspro/admin-dashboard.tsx`、`src/components/partspro/admin-products-panel.tsx`。

## 假设与未知项

- 默认币种 EUR。
- 首版是经营管理账本，不替代正式意大利会计、税务申报或发票系统。
- 历史成本仅在可从批次/订单行恢复时标记 `exact`；无法恢复时标记 `estimated` 或 `unmatched`。
- 供应商批次 `vat_mode` 为含税或未知时，首版在 UI/API 标记核对风险，不静默混入精确毛利。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 总调度/项目经理 | 任务卡、范围和验收口径 | 老板计划 | 任务卡落地 |
| WP-02 | Supabase Migration/RLS | 财务表、权限、RLS、成本层回填、订单成本快照触发器 | 现有订单/批次/权限表 | migration dry-run 安全 |
| WP-03 | PartsPro 业务契约/Next.js | 财务 repository、API、导出 | WP-02 类型契约 | API smoke 可运行 |
| WP-04 | 前端体验 | 后台财务面板、筛选、表格、费用/付款登记 | WP-03 API | 桌面/移动不溢出 |
| WP-05 | 平台发布部 | lint/build/migration 安全门记录 | WP-02-04 | 验证结果写入任务卡 |

## 批准要求

- 是否需要老板批准：生产 migration 应用和 Vercel 发布前需要。
- 是否需要 Supabase migration 安全门：需要。
- 是否需要 Vercel 发布门：需要。
- 是否需要 PartsPro 业务契约验收：需要。

## 验收标准

- 财务 panel 只对拥有 `panel.finance` 且可读权限的角色可见。
- admin 拥有全部 `finance.*`，auditor 只有 `panel.finance`、`finance.read`、`finance.export`。
- 财务汇总包含销售净额、进货净成本、COGS、毛利率、经营利润、库存成本价值、待收款、应付供应商。
- COGS 使用 `finance_order_line_cost_allocations`，成本可信度显示 `exact`、`estimated`、`unmatched`。
- 新增/修改费用、供应商付款和导出写入 `admin_audit_events`。
- CSV/XLSX 导出金额与 summary/ledger API 口径一致。

## 禁止事项

- 不得把历史无法追溯的成本显示为精确。
- 不得给销售、采购、仓库默认开启财务面板。
- 不得绕过 RLS 或在浏览器暴露 service role/secret。
- 不得自动应用破坏性 SQL、旧 pending migration 或不明 linked project。
- 不得覆盖用户未提交的无关改动。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
env SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
env SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无 whitespace error |
| `npm run lint` | pass | ESLint 通过 |
| `npm run build` | pass | Next.js 16 build/typecheck 通过，finance routes 已列入 route manifest |
| Supabase MCP `_list_migrations` | pass | `yiuxrjqexlfjtxxrkqvi` 远端最新为 `20260630231954_warehouse_replenishment_queue` |
| `supabase migration list --linked` | blocked | CLI 缺 `SUPABASE_ACCESS_TOKEN`，未能登录 |
| `supabase db push --linked --dry-run` | blocked | CLI 缺 `SUPABASE_ACCESS_TOKEN`，未能登录；本 migration 含历史财务回填，生产应用前需老板确认 |
| SQL 风险扫描 | review | 未发现 `drop table`/`truncate`；命中项为新表 grant、FK `on delete`、内部 usage update、审计 trigger 文案 |

## 执行记录

- 创建：2026-07-01
- 批准：老板要求 implement plan
- 开始：2026-07-01
- review：2026-07-01 lint/build 通过，Supabase CLI dry-run 登录阻塞
- verified：
- released：
- closed：

## 结果

已交付本地实现：财务权限、Supabase migration、repository/API/export、后台财务面板和任务追踪。尚未应用生产 migration；原因是本 migration 含历史数据回填，且本机 Supabase CLI 缺少 access token，无法完成 `db push --linked --dry-run`。
