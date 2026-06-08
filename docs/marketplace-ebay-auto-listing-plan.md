# eBay 自动刊登优化规划

最后更新：2026-06-08

## 当前 MVP

本阶段目标是让后台先能安全生成刊登计划，再决定是否发布、同步库存价格或拉取订单。MVP 不新增 Supabase migration，不连接 production，不自动运行 eBay 队列。

已采用的边界：

- `plan_listings`：只评估本地商品并写入 `marketplace_listings` 计划状态，不入队、不调用 eBay API。
- `publish_eligible`：只对本地评估为 eligible 的商品入队发布任务。
- `sync_inventory`：只对已发布且 `sync_enabled !== false` 的本地刊登入队同步任务。
- `import_orders`：只入队拉单任务，不直接在按钮点击时调用 eBay API。
- 已有 queued/running 的同类型同 SKU 任务会跳过，避免重复点击造成重复队列。

## 自动刊登资格

商品必须同时满足：

- 商品已在本地前台发布。
- 有主图或图库图片。
- 有大于 0 的零售价。
- `availableQty - stockBuffer > 0`。
- 命中启用的 eBay 类目映射。
- 类目映射要求的 required aspects 已能从商品或映射中生成。
- eBay merchant location、payment policy、return policy、fulfillment policy 已设置。
- 非危险品，或后续已建立人工合规确认流程。

不满足条件时写入 `marketplace_listings.last_error_message`，后台“刊登状态”显示阻断原因。

## 价格和库存规则

- eBay 价格使用：`retailPrice * (1 + markupPercent / 100) + markupFixed`。
- 币种固定为当前 marketplace 设置的 EUR。
- eBay 可售库存使用：`max(availableQty - stockBuffer, 0)`。
- 后续如需最低毛利保护、人工覆盖价或按平台费用反推售价，应新增独立任务并经过价格与客户部验收。

## 队列规则

- 发布任务：`publish_listing`。
- 同步任务：`sync_inventory`。
- 拉单任务：`import_orders`。
- 同一 provider、marketplace、job_type、target_sku/target_order_id 已存在 queued/running 时，不重复入队。
- 真正调用 eBay API 只发生在“执行队列”阶段。

## 开关和环境

- `plan_listings` 可在 eBay 自动化未启用时执行，用于预检。
- `publish_eligible` 要求 `enabled=true`、`autoPublishEnabled=true`。
- `sync_inventory` 要求 `enabled=true`、`autoSyncEnabled=true`。
- `import_orders` 要求 `enabled=true`、`orderImportEnabled=true`。
- production 环境还要求 `productionEnabled=true`。

## 后续任务

- P2：增加 SKU 级预检入口，从商品详情或商品列表只评估选中 SKU。
- P2：增加 eBay policy/aspect 拉取任务，减少人工填写 category mapping。
- P2：增加最低毛利保护和人工覆盖价，避免平台费用导致亏损。
- P1：在 sandbox 完整验证 publish、sync、import order、fulfillment 回写。
- P1：production 发布前由平台发布部执行 Vercel、Supabase、eBay 环境安全门。
