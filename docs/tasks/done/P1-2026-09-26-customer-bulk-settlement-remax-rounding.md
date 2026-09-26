# P1-2026-09-26-customer-bulk-settlement-remax-rounding

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260926-01

风险等级：R3

自治等级：L2

## 老板原始目标

在后台客户管理中增加客户全部未结清订单的一次结清和二次确认，并把在售 REMAX 指定到货批次的 B2B、零售价统一向上取整到下一个 0.10 欧元。

## 目标

提供可审计、原子化、并发安全的客户整户结清流程，并受控完成 REMAX 在售价调整。

## 业务影响

涉及客户账款、订单支付状态、后台收款审计，以及在售商品的客户价格。

## 完成定义

代码、合同测试、lint、build 和 linked dry-run 全部通过；老板明确批准后应用唯一待推送 migration，并完成迁移后只读核对与后台流程 smoke test。

## 主责部门

价格与客户部

## 协作部门

订单运营部、商品目录部、平台发布部

## 工程守门代理

PartsPro 业务契约代理、Supabase Migration 守门代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 当前执行代理 |
| Approver | 老板 |
| Consulted | 订单运营部、商品目录部、Supabase Migration 守门代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：后台客户管理详情 / 消费记录
- API：`/api/admin/customers/[customerId]/settlement`
- 数据表/RPC：`orders`、`order_events`、`admin_audit_events`、客户批量结清 RPC、REMAX 商品价格
- 文档：本任务卡
- 外部系统：Supabase PartsPro-V4（production-sensitive）

## 已知事实

- 一次结清覆盖该客户全部未取消、未删除、支付状态非 paid 的订单，不受详情页分页限制。
- 收款方式为现金或银行转账；收款时间默认当前时间并可编辑；参考号和备注可选。
- 钱包抵扣、历史部分实收和超额实收均纳入守恒计算与逐单审计。
- REMAX 范围限定为在售且属于 `REMAX-SONG-2026-07-A` 的 28 个商品；B2B 28 个、零售 18 个价格会变化。

## 假设与未知项

- 生产 migration 与 Vercel 应用代码已分别经过老板明确批准并独立发布。
- 本次 Vercel 发布从发布前线上提交 `73265ed81d96dd38d795b13885423c6ddeb91e18` 建立隔离候选，只叠加本任务的三个运行时文件，避免回滚或夹带主工作区改动。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 价格与客户部 | 客户结清 UI、API、RPC | 客户和订单合同 | 定向合同测试与 build 通过 |
| WP-02 | 商品目录部 | REMAX 指定批次向上取整与审计 | 生产只读预检 | dry-run 只包含本次 migration |
| WP-03 | 平台发布部 | 受控 migration 与上线核对 | 老板明确批准 | 迁移后核对和 smoke test 通过 |

## 批准要求

- 是否需要老板批准：需要；每次真实 `supabase db push --linked` 单独批准
- 是否需要 Supabase migration 安全门：需要
- 是否需要 Vercel 发布门：需要，已完成隔离候选、云端构建、候选 smoke 与正式域名提升
- 是否需要 PartsPro 业务契约验收：需要，已完成只读审查并修复阻断项

## 验收标准

- 后台只对同时具备 `customers.read` 与 `orders.manage` 的管理员显示和执行一次结清。
- 二次确认准确展示整户订单数、订单总额、钱包/已收和本次需收。
- 预览后订单集合或金额变化时整批拒绝；成功时同一事务更新全部订单并写逐单事件和客户级审计。
- REMAX 只改指定批次 active 商品的 B2B/retail 售价，不改成本、草稿商品或历史订单。

## 禁止事项

- 未经老板明确批准不得执行真实 linked migration。
- 不得夹带旧 migration、批量重写其他品牌价格或自动部署 Vercel。
- 不得覆盖或删除工作区内其他未提交改动。

## 验证命令

```bash
node --test tests/customer-bulk-settlement-contract.test.mjs tests/remax-commerce-contract.test.mjs tests/admin-order-pagination.test.mjs
npm run lint
npm run build
git diff --check
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 定向合同测试 | 通过 | 15/15 |
| `npm run lint` | 通过 | ESLint 退出码 0 |
| `npm run build` | 通过 | Next.js 16.2.6 编译、TypeScript、18 个静态页面通过 |
| `git diff --check` | 通过 | 无空白错误 |
| linked migration list | 通过 | local/remote 对齐至 `20260925131412`，仅本次 migration 待应用 |
| linked dry-run | 通过 | 仅列出 `20260926091650_admin_customer_bulk_settlement_and_remax_price_rounding.sql` |
| 生产 migration 应用后核对 | 通过 | local/remote 对齐至 `20260926091650`；28 个目标商品全部取整且审计 28 条 |
| 隔离 Vercel 候选 | 通过 | 基线 `73265ed8…`；运行时差异仅结清面板、route 和服务层三个文件 |
| 候选合同测试 / lint / build | 通过 | 6/6、ESLint 退出码 0、Next.js 16.2.6 production build 通过 |
| Vercel 云端构建 | 通过 | 部署 `dpl_RuZ7FWurm14GBUY7iz91Ze11YbDw` 为 READY / production |
| 正式站 smoke | 通过 | `partspro.app` 已解析到新部署；后台预览成功并取消；新增 route 未登录返回 401；无前端或路由运行时错误 |

## 执行记录

- 创建：2026-09-26
- 批准：2026-09-26，老板明确批准本次 linked migration
- 开始：2026-09-26
- review：2026-09-26，业务契约与 migration 守门完成两轮只读审查；最终 P0/P1/P2 均为 0
- verified：2026-09-26，生产 migration、RPC 权限、REMAX 价格与审计核对通过；本地桌面及 390×844 浏览器 smoke test 通过且未提交客户结清
- released：2026-09-26，数据库 migration 与 Vercel 应用代码均已发布
- closed：2026-09-26，生产只读验收完成；未执行任何客户真实结清

## 残余风险

- 已在本地隔离分支 `codex/customer-settlement-remax-rounding` 保存发布提交；尚未推送或合并到远端 `main`。后续若从远端 `main` 触发 Git 自动部署，在合并该提交前可能覆盖本次 CLI 发布，推送/PR 需另行授权。

## 结果

生产 migration 已应用并通过只读核对：28 个目标 REMAX 商品全部完成取整，价格审计 28 条，两条结清 RPC 权限符合预期。应用代码已通过隔离候选发布到 Vercel Production，正式后台的一次结清预览、二次确认字段和权限门均通过 smoke test；测试过程只预览并取消，未产生客户结清记录。
