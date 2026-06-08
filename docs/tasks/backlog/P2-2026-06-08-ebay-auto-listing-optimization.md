# P2-2026-06-08-ebay-auto-listing-optimization

状态：backlog

优先级：P2

## 目标

规划 eBay 自动刊登优化方案，让 PartsPro 后台以后能更稳定地判断哪些商品可自动刊登、如何同步价格库存、如何处理失败队列和订单回流。

## 业务影响

提升电商渠道运营效率，减少人工刊登、库存同步和失败重试成本；避免 eBay 刊登内容、价格或库存与本地商品真相不一致，降低超卖和错误订单风险。

## 主责部门

电商渠道部

## 协作部门

- 商品目录部：确认商品资料、图片、分类、兼容性和上架完整性。
- 价格与客户部：确认 eBay 售价、markup、币种和本地价格规则边界。
- 仓库库存部：确认 eBay 可售库存、stock buffer、缺货和低库存同步规则。
- 订单运营部：确认 eBay 订单回流、本地订单状态、库存锁定和失败处理。

## 工程守门代理

- PartsPro 业务契约代理
- Next.js 16 App Router 代理
- Supabase RLS/权限代理
- Supabase Migration 守门代理，仅在后续方案需要 schema/RPC/migration 时启用
- Vercel 发布代理，仅在后续进入实现和发布时启用

## 涉及范围

- 页面：`/admin` 的 marketplace/eBay 面板、商品后台中与 eBay eligibility 相关的入口。
- API：`src/app/api/admin/ebay/**`、`src/app/api/ebay/**`、可能涉及商品后台 API。
- 数据表/RPC：`marketplace_settings`、`marketplace_listings`、`marketplace_sync_jobs`、`marketplace_category_mappings`、`marketplace_order_links`、`products`、`inventory_items`。
- 文档：`AGENTS.md`、`docs/tasks/**`、必要时新增 eBay 运营 runbook。
- 外部系统：eBay sandbox/production、eBay OAuth、eBay inventory/listing/order APIs。

## 初步规划问题

- 自动刊登资格：哪些商品可以进入自动刊登，哪些必须人工补资料后再刊登。
- 价格规则：eBay 售价是否使用固定 markup、百分比 markup、最低毛利保护或人工覆盖价。
- 库存规则：是否使用 `available_qty - stock_buffer`，低库存和缺货时如何同步或下架。
- 类目映射：本地分类、品牌、型号系列和 eBay category/aspects 的映射缺口。
- 队列策略：发布、库存同步、价格同步、订单导入的重试次数、幂等键和失败提示。
- 环境隔离：sandbox 与 production 设置、连接、队列和按钮必须清楚区分。

## 验收标准

- 输出一份可实现的 eBay 自动刊登优化方案，包含资格规则、价格规则、库存规则、队列规则、失败处理和上线顺序。
- 明确哪些字段来自本地商品真相，哪些字段来自 marketplace 设置，哪些字段可人工覆盖。
- 明确 sandbox 验证流程和 production 发布前安全门。
- 明确是否需要 Supabase migration；如果需要，列出表/RPC/权限变化，但本 backlog 任务不创建 migration。
- 明确最小可交付版本和后续迭代边界。

## 禁止事项

- 当前任务只规划，不实现代码、不改数据库、不创建 migration、不运行 eBay 队列。
- 不连接或修改 eBay production 设置。
- 不批量发布商品，不修改真实刊登，不同步真实库存。
- 不把外部 eBay 订单直接写成本地订单，除非后续任务经过订单契约验收。

## 验证命令

```bash
git diff --check
```

## 执行记录

- 创建：2026-06-08
- 开始：未开始
- 完成：未完成

## 结果

待后续进入 `now/` 后，由电商渠道部先输出详细方案，再决定是否拆分为 schema、API、UI、队列和发布验证任务。
