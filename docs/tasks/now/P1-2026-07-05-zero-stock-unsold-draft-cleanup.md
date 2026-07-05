# P1 2026-07-05 零库存未售卖商品转草稿整理计划

## 状态

- 执行状态：已执行
- 执行时间：2026-07-05
- 审计 run id：`e2e47fed-8270-4f98-991c-6ab5260c1393`
- 候选 CSV：`/tmp/partspro-zero-stock-unsold-candidates-20260705.csv`
- 候选数量：`17,377`
- 更新数量：`17,377`
- 审计事件数量：`17,377`
- 执行后剩余 `active + 零库存 + 未售卖` 候选：`0`

## 目标

将当前后台中“没有库存且没有售卖记录”的商品统一转为 `draft`，避免无库存、无价格的历史商品继续出现在前台目录中。

本任务已经按下方规则执行完成。后续如需回滚，必须使用本次审计 run id 定位记录。

## 当前只读核对结果

- 查询时间：2026-07-05
- 当前 `active + stock_qty <= 0` 商品：`17,383`
- 其中没有任何 `order_lines` 记录的商品：`17,377`
- 其中已有订单明细记录的零库存商品：`6`，本次不自动转草稿
- 候选商品供应商：全部为 `External Supplier`
- 候选商品价格状态：`17,377` 个均缺有效价格，`retail_price = 0` 或 `b2b_price = 0`
- 候选商品图片状态：`1` 个缺主图，其余有 `image_path`

前台隐藏依据：

- 公开目录读取 `products` 表时强制过滤 `status = 'active'`。
- 单品详情如果商品状态不是 `active`，会返回空结果。
- 因此商品转为 `draft` 后，前台目录、搜索和详情页都不应显示。

## 候选定义

只允许同时满足以下条件的商品进入本次批量转草稿：

1. `products.status = 'active'`
2. `products.stock_qty <= 0`
3. `inventory_items.actual_qty` 汇总为 `0` 或没有库存行
4. `inventory_items.available_qty` 汇总为 `0` 或没有库存行
5. `inventory_items.locked_qty` 汇总为 `0` 或没有库存行
6. 该 `sku_code` 在 `order_lines` 中没有任何记录

保守规则：

- 只要出现过订单明细，就先保留 `active`，即使订单后来取消，也进入人工复核清单。
- 不修改库存、价格、图片、供应商、批次和商品名称。
- 不处理已经是 `draft`、`hidden`、`blocked` 的商品。
- 不处理 `stock_qty > 0` 或库存表仍有可用/实际库存的商品。

## 上架失败原因

截图商品：

- SKU：`3000000378380`
- 名称：`Original Main Camera Samsung Galaxy Xcover 7 Pro G766 GH96-19313A 50MP`
- 当前状态：`draft`
- 当前库存：`stock_qty = 0`，`actual_qty = 0`，`available_qty = 0`
- 售卖记录：无 `order_lines`
- 图片：已有 `image_path`
- 价格：`retail_price = 0`，`b2b_price = 0`，`cost_price = 0`

后台点击“上架”会调用 `admin_publish_product`，该 RPC 会先执行 `private.partspro_product_publish_issues`。目前发布校验要求商品必须有 SKU、名称、品牌、分类、MOQ、批发价、VAT、保修、仓库、供应商、兼容型号和主图。

该 SKU 失败的直接原因是 `b2b_price = 0`，触发 `b2b_price` 缺项。当前 UI 只显示通用错误“商品动作失败”，没有把 RPC 返回的 `Product is not publishable: b2b_price` 展示出来。

后续建议补一项后台体验修复：上架失败时解析并显示具体缺项，例如“缺批发价 / b2b_price”，避免只显示通用错误。

## 执行流程

### 1. 预检导出

先只读导出候选清单，字段至少包括：

- `sku_code`
- `name`
- `brand`
- `category`
- `supplier`
- `batch_code`
- `stock_qty`
- `actual_qty`
- `available_qty`
- `locked_qty`
- `retail_price`
- `b2b_price`
- `image_path`
- `last_movement_at`

SQL 草案：

```sql
with inventory_totals as (
  select
    upper(btrim(sku_code)) as sku_code,
    coalesce(sum(actual_qty), 0) as actual_qty,
    coalesce(sum(available_qty), 0) as available_qty,
    coalesce(sum(locked_qty), 0) as locked_qty
  from public.inventory_items
  group by upper(btrim(sku_code))
),
sold_skus as (
  select distinct upper(btrim(sku_code)) as sku_code
  from public.order_lines
  where nullif(btrim(sku_code), '') is not null
),
candidates as (
  select
    p.sku_code,
    p.name,
    p.brand,
    p.category,
    p.supplier,
    p.batch_code,
    p.stock_qty,
    coalesce(i.actual_qty, 0) as actual_qty,
    coalesce(i.available_qty, 0) as available_qty,
    coalesce(i.locked_qty, 0) as locked_qty,
    p.retail_price,
    p.b2b_price,
    p.image_path,
    p.updated_at
  from public.products p
  left join inventory_totals i on i.sku_code = upper(btrim(p.sku_code))
  left join sold_skus s on s.sku_code = upper(btrim(p.sku_code))
  where p.status = 'active'
    and coalesce(p.stock_qty, 0) <= 0
    and coalesce(i.actual_qty, 0) <= 0
    and coalesce(i.available_qty, 0) <= 0
    and coalesce(i.locked_qty, 0) <= 0
    and s.sku_code is null
)
select *
from candidates
order by supplier, brand, category, sku_code;
```

### 2. 人工确认

确认导出 CSV 后再执行：

- 抽查每个大类至少 5 个 SKU。
- 确认候选数与 SQL 统计一致。
- 确认 6 个有订单明细的零库存商品没有进入候选。
- 确认新近导入、仍有库存、已售卖或人工隐藏的商品不在候选中。

### 3. 事务更新

正式执行必须放在一个事务中，并写入审计事件。

SQL 草案：

```sql
begin;

with inventory_totals as (
  select
    upper(btrim(sku_code)) as sku_code,
    coalesce(sum(actual_qty), 0) as actual_qty,
    coalesce(sum(available_qty), 0) as available_qty,
    coalesce(sum(locked_qty), 0) as locked_qty
  from public.inventory_items
  group by upper(btrim(sku_code))
),
sold_skus as (
  select distinct upper(btrim(sku_code)) as sku_code
  from public.order_lines
  where nullif(btrim(sku_code), '') is not null
),
candidates as (
  select p.*
  from public.products p
  left join inventory_totals i on i.sku_code = upper(btrim(p.sku_code))
  left join sold_skus s on s.sku_code = upper(btrim(p.sku_code))
  where p.status = 'active'
    and coalesce(p.stock_qty, 0) <= 0
    and coalesce(i.actual_qty, 0) <= 0
    and coalesce(i.available_qty, 0) <= 0
    and coalesce(i.locked_qty, 0) <= 0
    and s.sku_code is null
),
updated as (
  update public.products p
  set
    status = 'draft',
    stock_status = private.partspro_stock_status(p.stock_qty),
    updated_at = now()
  from candidates c
  where p.id = c.id
  returning c as before_product, p as after_product
)
insert into public.admin_audit_events (
  action,
  entity_type,
  entity_id,
  sku_code,
  before_data,
  after_data,
  reason,
  request_metadata
)
select
  'product.bulk_draft_zero_stock_unsold',
  'product',
  (after_product).id::text,
  (after_product).sku_code,
  to_jsonb(before_product),
  to_jsonb(after_product),
  'Zero stock and never sold product cleanup',
  jsonb_build_object(
    'rule', 'active stock_qty<=0 inventory<=0 no_order_lines',
    'executed_at', now()
  )
from updated;

commit;
```

## 回滚方案

仅当执行后发现规则误伤时，按同一批审计事件回滚：

```sql
begin;

with audit_rows as (
  select *
  from public.admin_audit_events
  where action = 'product.bulk_draft_zero_stock_unsold'
    and reason = 'Zero stock and never sold product cleanup'
  order by created_at desc
)
update public.products p
set
  status = coalesce(a.before_data ->> 'status', p.status),
  stock_status = coalesce(a.before_data ->> 'stock_status', p.stock_status),
  updated_at = now()
from audit_rows a
where p.sku_code = a.sku_code;

commit;
```

回滚前必须先导出 `audit_rows`，确认只包含本次执行的批量事件。

## 验收标准

执行后必须满足：

- `active + stock_qty <= 0 + no order_lines` 候选数为 `0`
- 原本有订单明细的 6 个零库存商品没有被转草稿
- `draft` 商品在前台目录、搜索和详情页不可见
- 后台商品统计中 `active` 数量下降，`draft` 数量上升，变化量等于执行候选数
- 审计表存在同数量的 `product.bulk_draft_zero_stock_unsold` 事件
- 抽查 20 个被转草稿 SKU，库存、价格、图片、供应商、批次字段没有变化

本次执行后实际验证：

- `active_products = 523`
- `draft_products = 17,379`
- `active_zero_stock = 6`
- `remaining_zero_stock_unsold_candidates = 0`
- `cleanup_audit_events = 17,377`

## 后续改进

1. 后台“上架失败”提示需要显示具体缺项。
2. 商品列表可增加“零库存且未售卖”筛选器，方便人工复核。
3. 新建或导入商品时，如果库存为 0 且价格为 0，默认保持 `draft`，不允许自动上架。
4. 若业务决定“0 库存商品一律不可上架”，需要把 `stock_qty > 0` 加入 `private.partspro_product_publish_issues` 的发布校验。
