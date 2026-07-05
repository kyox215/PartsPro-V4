# P1 2026-07-05 Admin Product And Inventory Health

## Goal

完善后台商品问题筛选、上架失败原因提示、库存体检入口，降低零库存商品误上架、库存台账不一致、锁货异常无法发现的风险。

## Scope

- 商品后台动作失败返回结构化原因，尤其是草稿上架失败时明确缺少字段。
- 商品后台新增问题快捷筛选：缺图、缺价、零库存未售、零库存售过。
- 新增只读库存体检 API 和仓库面板区块，检查商品库存与库存台账、锁货与订单预留、已售零库存 active SKU。
- 新增 `admin_product_issue_filter` migration，但生产应用必须等前置 finance migration 获得明确批准。

## Risk

- 风险等级：P1 / R2。
- 涉及商品发布、库存、订单行、Supabase RPC。
- 禁止直接改生产库存数量或批量上下架。

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 本地 dev server smoke：`/admin` 返回 `200` 并重定向未登录用户到 `/login?next=/admin`；`/api/admin/products?issueFilter=zero_stock_sold&limit=1` 和 `/api/admin/inventory-health?limit=1` 在无 session 时返回预期 `401 ADMIN_FORBIDDEN missing_session`。

## Execution Notes

- 本地已实现结构化上架失败提示，UI 可显示不可上架的具体原因。
- 本地已实现商品问题快捷筛选；普通商品列表在 migration 未应用时仍不传新 RPC 参数。
- 本地已实现旧 RPC 兼容 fallback：如果线上 `admin_list_products` 还没有 `p_issue_filter` 参数，问题筛选会在 repository 层只读聚合 `products`、`inventory_items`、`product_restock_requests`、已完成订单行，避免后台点击筛选直接报错。
- fallback 与正式 RPC 保持相同库存状态筛选语义，按 `products.stock_status` 匹配；销量读取使用稳定排序，达到安全读取上限时中止而不是把售过商品误判为未售。
- 本地已实现 `/api/admin/inventory-health` 和仓库面板库存体检区块。
- 已修复库存体检降级：体检接口失败只影响体检区块，不清空原有缺货与补货队列。
- 2026-07-05 只读远端核对：`products` 共 `17902`，`draft` 共 `17379`，缺主图 `2`，已上架且可用库存为 `0` 的商品 `6` 个。
- 2026-07-05 只读远端核对：已上架零库存商品中，未售过 `0` 个，已售过 `6` 个；因此当前没有需要按“零库存且没卖过”直接批量设草稿的 active 商品。
- 2026-07-05 只读远端核对：线上仍只有旧 `admin_list_products` RPC 签名，`20260705142329_admin_product_issue_filter.sql` 尚未应用。
- 2026-07-05 只读远端基准：缺价 `17378`，缺图 `2`，零库存未售 `17378`，零库存售过 `6`。

## Current Blocker

`20260701210603_admin_finance_ledger.sql` 是当前本地最早 pending migration。Supabase 安全审查拒绝在本任务名义下直接应用该生产 finance migration。需要老板明确批准后，才能按顺序应用 finance migration，再应用 `20260705142329_admin_product_issue_filter.sql`。

## Subagents

- 商品动作错误闭环检查。
- `admin_list_products` / `issueFilter` RPC 契约检查。
- 库存体检 API/UI 方案检查。
- 旧 RPC fallback 兼容层只读复核，并已处理 P2 findings。
