# PartsPro 到货导入声明规则

本文档是 PartsPro 后续每次供应商到货、PDF 发票/装箱单解析、商品补资料、抓图、入库和上架时的标准声明规则。执行导入前，必须先按本文档生成导入计划；执行导入时，必须只按已确认的计划写库。

最后更新：2026-06-04

## 适用范围

- 适用于 Mobilax、UTOPYA，以及未来其他供应商的到货批量导入。
- 适用于远端 Supabase `products`、`inventory_items`、`suppliers`、`supplier_batches`、`supplier_batch_lines`、`admin_audit_events` 和 Storage `product-images`。
- 适用于两类商品：
  - 数据库中已有商品资料，只需要补成本、供应商批次、图片和库存。
  - 数据库中缺商品资料，需要先建商品档案，再入库。

## 核心原则

1. 先只读预检，再抓图，再事务写库，最后验证。
2. 导入前必须确认 PDF 行数、唯一 SKU/EAN 数、数量合计、金额合计、发票号、订单号、供应商和批次号。
3. 已有商品不允许重置库存，只允许按本批 `received_qty` 增量入库。
4. 缺失商品先创建 `products`，初始库存为 `0`，再统一执行库存增量。
5. 品牌只写入 `brand` 字段，`model` 和 `compatibility_models` 不允许带品牌前缀。
6. SKU 主键优先使用 EAN/条码；供应商内部 SKU 写入 `alternative_skus` 和批次行，不覆盖主 SKU。
7. 没有精确图片的商品不强行上架，必须保持 `draft` 并输出待补图清单。
8. 每次写库必须写入审计事件，保证以后能知道是谁家的货、哪张发票、哪个批次。
9. 任何预检结果和计划声明不一致时，立即中止，不做部分导入。
10. 不使用会破坏现有数据的操作，例如清空库存、覆盖无关批次、删除旧商品、批量改历史型号。

## 标准导入声明模板

每次到货导入前，先填写并确认下面声明。没有确认完整声明时，不执行写库。

```md
# 到货导入声明

供应商：
供应商显示标签：
供应商网站：
源文件：
发票号：
订单号：
发票日期：
批次号：
仓库位置：
币种：
VAT 模式：

PDF 商品行数：
唯一 EAN/SKU 数：
到货数量合计：
成本合计：

数据库预检：
- 已有商品数：
- 缺商品资料数：
- SKU 冲突数：
- 已存在同批次行数：

图片源：
- 主图片来源：
- 精确匹配规则：
- 未匹配图片处理：

价格规则：
- cost_price：
- retail_price：
- b2b_price：

发布规则：
- 可上架条件：
- 草稿条件：

审计 reason：
```

## Preflight 只读检查

导入前必须只读检查，不允许在这一阶段写数据库或上传图片。

### PDF 解析检查

必须从 PDF 中解析并确认：

- `invoice_no`
- `order_no`
- `invoice_date`
- `supplier`
- `currency`
- `vat_mode`
- 每行 `ean` 或主 SKU
- 每行 `supplier_sku`
- 每行商品名称
- 每行 `qty_received`
- 每行 `unit_cost`
- 每行 `line_total`

必须输出：

- PDF 商品行数。
- 唯一 EAN/SKU 数。
- 数量合计。
- 成本合计。
- 是否存在负数、0 数量、0 成本、重复 EAN、重复供应商 SKU。

中止条件：

- PDF 总数量和行项目合计不一致。
- PDF 金额和行项目金额不一致，且无法解释为四舍五入差异。
- 有商品行没有 EAN/主 SKU。
- 有重复 EAN 但商品名称、成本或型号冲突。
- 用户说“没有缺货”，但 PDF 或供应商页面显示缺货。

### 数据库预检

必须查询当前数据库状态：

```sql
select
  count(*) as matched_products
from public.products
where sku_code = any(:sku_codes);
```

检查项：

- `products.sku_code` 是否已有。
- `products.alternative_skus` 是否命中供应商 SKU。
- 同一批次 `batch_code` 是否已导入过。
- `supplier_batches.batch_code` 是否已存在。
- `supplier_batch_lines` 是否已有同一发票/订单/sku 行。
- 已有商品的库存、价格、图片和状态基线。
- 缺商品资料的 SKU 清单。

中止条件：

- 同一个 SKU 已属于另一个真实商品。
- 同一批次已完整导入，且用户没有明确要求重跑修正。
- 数据库匹配数和计划声明不一致。
- 新商品缺少必要字段且无法从供应商页面补齐。

## SKU 和供应商编码规则

### 主 SKU

- `products.sku_code` 优先使用 EAN。
- 如果供应商没有 EAN，才允许使用稳定、唯一、可追踪的供应商 SKU。
- 主 SKU 不允许包含供应商前缀，例如 `UTOPYA-`、`MOBILAX-`、`EC@-`，除非该值本身就是唯一的供应商主编码且没有 EAN。

### 供应商 SKU

- 供应商内部 SKU 写入：
  - `products.alternative_skus`
  - `supplier_batch_lines.supplier_sku`
  - 审计 metadata
- 后台搜索必须能通过 EAN、供应商 SKU、型号代码找到商品。

### 重复 SKU

重复 SKU 的处理顺序：

1. 如果重复行是同一商品、同一成本、同一名称，可合并数量。
2. 如果重复行名称相同但成本不同，保留为同一商品的不同批次成本记录，入库仍按数量累加。
3. 如果重复行指向不同商品，立即中止，由人工确认。

## 供应商与批次管理规则

每次导入必须创建或复用供应商记录。

`public.suppliers` 标准字段：

- `code`
- `name`
- `display_label`
- `vat_number`
- `eori`
- `country`
- `website_url`
- `tags`
- `status`
- `metadata`

每次到货必须创建或复用批次记录。

`public.supplier_batches` 标准字段：

- `batch_code`
- `supplier_id`
- `invoice_no`
- `order_no`
- `invoice_date`
- `received_at`
- `total_qty`
- `total_cost`
- `currency`
- `vat_mode`
- `tags`
- `source_file_name`
- `metadata`

每个 PDF 商品行必须写入 `public.supplier_batch_lines`：

- `batch_id`
- `ean`
- `supplier_sku`
- `sku_code`
- `name`
- `qty_received`
- `unit_cost`
- `line_total`
- `image_status`
- `product_status`
- `metadata`

兼容显示字段仍要同步：

- `products.supplier`
- `products.batch_code`
- `inventory_items.supplier`
- `inventory_items.batch_code`

## 商品资料字段规则

### 必填字段

创建或更新商品时，必须保证以下字段完整：

- `sku_code`
- `name`
- `brand`
- `model`
- `model_codes`
- `model_series`
- `category`
- `quality_grade`
- `cost_price`
- `retail_price`
- `b2b_price`
- `stock_qty`
- `stock_status`
- `status`
- `location`
- `supplier`
- `batch_code`
- `compatibility_models`
- `alternative_skus`
- `image_path` 或待补图原因

### 分类

当前手机配件屏幕类商品统一：

- `category = 'Schermi'`

如果未来导入电池、摄像头、尾插等，必须先确认前台目录已有对应分类命名，不允许随意创建相近分类。

### 品质

默认规则：

- 普通屏幕、Incell、OLED、带框屏：`quality_grade = 'A'`
- 名称包含 `ReLife`、`Refurbished`、`Original Refurbished`：`quality_grade = 'Refurbished'`
- 只有供应商明确标注更高或更低等级时，才允许写入 `A+` 或 `B`

## 型号归一化规则

这是防止型号列表污染的最重要规则。

### 总规则

- `brand` 字段保存品牌，例如 `Samsung`、`Xiaomi`、`Realme`、`TCL`。
- `model` 不写品牌前缀。
- `compatibility_models` 不写品牌前缀。
- `model_codes` 保存精确机型代码，例如 `A176B`、`A556B`、`A057`。
- `model_series` 必须根据 `brand + model` 重新计算，不手写猜测。

禁止写法：

- `Samsung Galaxy A17 5G`
- `Xiaomi Redmi Note 11`
- `Realme C75 4G`
- `TCL 505`

推荐写法：

- `Galaxy A17 5G A176`
- `Redmi Note 11 4G`
- `C75`
- `505`

### Canonical 匹配顺序

创建或更新商品前，必须执行型号归一化：

1. 从商品名、供应商 SKU、EAN 页面、兼容性字段提取品牌、型号和机型代码。
2. 用 `brand + model_codes` 精确查找既有 `products.model` 和 `products.compatibility_models`。
3. 如果找到精确匹配，使用既有 canonical 型号。
4. 如果没有精确匹配，使用无品牌前缀且带明确机型代码的新 canonical 型号。
5. 不允许把相近型号误合并。

### Samsung 规则

- `A176B` 应写为 `Galaxy A17 5G A176`。
- `A556B` 应写为 `Galaxy A55 5G A556`。
- `A057` 应写为 `Galaxy A05S A057`，不能并入 `Galaxy A05 A055`。
- A15 `A155F/A156B` 必须保留两个兼容型号：
  - `Galaxy A15 4G A155`
  - `Galaxy A15 5G A156B`
- A52 `A525/A526` 必须保留两个兼容型号：
  - `Galaxy A52 4G A525`
  - `Galaxy A52 5G A526`

### Xiaomi / Redmi / POCO 规则

- `model` 不写 `Xiaomi` 前缀。
- 如果供应商名称缺少网络制式，但既有目录有明确制式，优先对齐既有目录：
  - `Redmi Note 11` -> `Redmi Note 11 4G`
  - `Redmi 13` -> `Redmi 13 4G`
- `Redmi Note 11`、`Redmi Note 11S`、`Redmi Note 11 Pro` 不允许互相合并。

### Realme 规则

- `Realme C75 4G` -> `C75`
- 如果存在 `C75 4G` 和 `C75 5G` 两种真实机型，必须保留制式，不允许只写 `C75`。

### TCL 规则

- `TCL 505` -> `505`
- 多个 TCL 数字型号不允许按前缀合并。

### Vivo / OPPO / Motorola / Honor 规则

- 去掉品牌前缀。
- 保留系列和机型代码。
- 如果型号代码存在，必须写入 `model_codes`。

## 价格规则

除非用户在本次导入计划中明确指定其他规则，否则使用：

- `cost_price = PDF unit_cost`
- `retail_price = ceil(cost_price + 5)`
- `b2b_price = ceil(cost_price + 5)`

价格验证 SQL：

```sql
select sku_code, cost_price, retail_price, b2b_price
from public.products
where batch_code = :batch_code
  and (
    retail_price <> ceil(cost_price + 5)
    or b2b_price <> ceil(cost_price + 5)
  );
```

中止条件：

- PDF 成本无法解析。
- 价格规则和计划声明不一致。
- 已有商品价格将被改低，且用户没有明确允许。

## 库存规则

### 已有商品

已有商品只允许增量入库：

- `products.stock_qty = products.stock_qty + received_qty`
- `inventory_items.actual_qty = inventory_items.actual_qty + received_qty`
- `inventory_items.available_qty = inventory_items.available_qty + received_qty`

不允许：

- 把库存设置成 PDF 数量。
- 清空锁定数量。
- 覆盖其他批次库存。
- 删除旧库存行。

### 缺商品资料

缺商品资料必须先：

1. 插入 `products`，`stock_qty = 0`。
2. 插入或准备 `inventory_items`，数量为 `0`。
3. 再统一执行入库增量。

这样可以保证所有商品走同一套库存调整和审计逻辑。

### 库存状态

入库后根据库存自动计算：

- `stock_qty <= 0` -> `out_of_stock`
- `stock_qty > 0` 且低于低库存阈值 -> `low_stock`
- 其他 -> `in_stock`

不可人工把有库存商品写成 `out_of_stock`。

## 图片规则

### 抓图优先级

1. 供应商页面按 EAN 精确匹配。
2. 按供应商 SKU 精确匹配。
3. 按品牌 + 型号 + 商品名称匹配。
4. 仍无法精确确认时，列入待补图，不发布。

### Mobilax 图片

Mobilax 使用：

```text
https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/{image_id}?size=bg
```

Storage 路径：

```text
products/imported/{brand}/{sku}-{image_id}.{ext}
```

### UTOPYA 图片

UTOPYA Storage 路径：

```text
products/imported/utopya/{batch_code_lower}/{ean}-{image_id_or_hash}.{ext}
```

### 写入字段

成功上传后写入：

- `products.image_path`
- `products.gallery_image_paths`
- `products.image_alt`
- `supplier_batch_lines.image_status = 'uploaded'`

未抓到精确图片：

- `products.status = 'draft'`
- `supplier_batch_lines.image_status = 'missing'`
- 输出待补图清单

## 发布规则

商品设为 `active` 必须同时满足：

- 商品资料完整。
- `brand`、`model`、`category`、`compatibility_models` 正确。
- `cost_price`、`retail_price`、`b2b_price` 正确。
- `stock_qty > 0`。
- 有精确图片并已上传 Storage。
- 没有 SKU 或型号冲突。

以下情况必须保持 `draft`：

- 缺图片。
- 供应商页面无法确认兼容型号。
- 型号只有模糊名称，没有代码或现有 canonical。
- 商品名和 EAN 对不上。
- 价格或数量存在疑问。

## 数据库写入顺序

推荐执行顺序：

1. 解析 PDF 并生成 payload。
2. 只读 preflight。
3. 抓取图片并上传 Storage。
4. 开启数据库事务。
5. upsert `suppliers`。
6. upsert `supplier_batches`。
7. insert/upsert `supplier_batch_lines`。
8. 对缺失商品 insert `products`，初始库存 `0`。
9. 对已有商品 update 成本、价格、供应商、批次、图片和资料补全字段。
10. 统一执行库存增量。
11. upsert/update `inventory_items`。
12. 根据完整性设置 `active` 或 `draft`。
13. 插入 `admin_audit_events`。
14. 提交事务。
15. 执行验证 SQL。

事务中不允许执行网络抓图。图片必须在事务前准备好。

## 审计规则

每次导入必须写入 `admin_audit_events`。

常用 action：

- `product.create`
- `product.update`
- `product.stock_adjust`
- `product.images_update`
- `product.publish`

`reason` 标准格式：

```text
{SUPPLIER} {BATCH_CODE} received shipment
```

修正类操作：

```text
{BATCH_CODE} model normalization / merge with existing device models
```

metadata 至少包含：

- `supplier`
- `batch_code`
- `invoice_no`
- `order_no`
- `source_file_name`
- `qty_received`
- `unit_cost`
- `old_stock_qty`
- `new_stock_qty`
- `image_path`

## 导入后验证

### 自动批次完整性校验

每次供应商到货导入完成后，必须先运行批次完整性脚本：

```bash
npm run verify:supplier-batch -- :batch_code
```

例如：

```bash
npm run verify:supplier-batch -- UTOPYA-7091760
```

脚本会只读检查：

- `supplier_batches.total_qty` 是否等于 `supplier_batch_lines.qty_received` 合计。
- `supplier_batches.total_cost` 是否等于 `supplier_batch_lines.line_total` 合计，允许 `0.01` 欧元内四舍五入误差。
- 每条 `qty_received > 0` 的到货行是否能通过 `sku_code` / `ean` 精确关联到 `products.sku_code`。
- 每个关联商品是否有 `inventory_items`。
- `product_status = active` 或商品 `status = active` 时是否有 `image_path`。
- `image_status = uploaded` 时商品是否确实写入主图路径。
- `retail_price = b2b_price = ceil(cost_price + 5)`。
- `model` / `compatibility_models` 是否重复带品牌前缀。

脚本返回非零退出码时，本批导入不得标记为完成，也不得只凭后台 UI 把它解释成真实“缺商品”。先修复真实数据或查询/API 错误，再重新运行脚本。

后台“到货批次”页面如果显示 `缺商品`，必须用本脚本复核。如果脚本通过但 UI 仍显示 `缺商品 / Error`，说明是后台核对接口或前端展示层的问题，不允许修改库存或重复导入。

### 批次数量

```sql
select
  count(*) as product_count,
  sum(stock_qty) as stock_sum
from public.products
where batch_code = :batch_code;
```

注意：如果同一商品有历史库存，`sum(stock_qty)` 不是本批增量。验证本批增量时必须查 `supplier_batch_lines.qty_received` 或审计 metadata。

```sql
select
  count(*) as line_count,
  sum(qty_received) as received_qty_sum,
  sum(line_total) as total_cost_sum
from public.supplier_batch_lines
where batch_id = (
  select id from public.supplier_batches where batch_code = :batch_code
);
```

### 价格

```sql
select count(*) as bad_price_count
from public.products
where batch_code = :batch_code
  and (
    retail_price <> ceil(cost_price + 5)
    or b2b_price <> ceil(cost_price + 5)
  );
```

### 型号前缀污染

```sql
select sku_code, brand, model
from public.products
where batch_code = :batch_code
  and (
    model ilike brand || ' %'
    or exists (
      select 1
      from unnest(compatibility_models) as cm(value)
      where cm.value ilike brand || ' %'
    )
  );
```

结果必须为 0 行。

### 图片和上架

```sql
select sku_code, status, image_path, gallery_image_paths
from public.products
where batch_code = :batch_code
  and status = 'active'
  and (
    nullif(btrim(coalesce(image_path, '')), '') is null
    or cardinality(coalesce(gallery_image_paths, '{}'::text[])) = 0
  );
```

结果必须为 0 行。

### 供应商和批次

```sql
select sku_code, supplier, batch_code, location
from public.products
where batch_code = :batch_code
  and (
    supplier <> :supplier
    or location <> :location
  );
```

结果必须为 0 行。

### 后台搜索

至少验证：

- EAN 能搜到。
- 供应商 SKU 能搜到。
- 型号代码能搜到。
- canonical 型号能搜到。
- 供应商筛选能返回本批商品。
- 批次筛选能返回本批商品。

## 强制中止清单

遇到任何一项，必须停止导入：

- PDF 解析结果和用户声明不一致。
- 数据库已有商品匹配数量和计划不一致。
- 有 SKU 指向不同商品。
- 有 EAN 但供应商页面匹配到不同商品。
- 无法确定品牌或型号。
- 型号只能模糊匹配到相近机型。
- 图片不是精确商品图，但计划要求上架。
- 成本、数量或 VAT 无法确认。
- 同一批次已导入过，且没有明确重跑修正计划。
- 写库前验证 payload 数量和 PDF 数量不一致。

## 推荐导入计划格式

每次给用户的执行计划应包含：

```md
# {BATCH_CODE} 批量入库、补资料、抓图上架计划

## Summary
- 来源 PDF：
- 供应商：
- 发票：
- 订单：
- 日期：
- 批次：
- 仓库：
- 行数：
- 数量：
- 总成本：
- 当前数据库匹配：

## Data To Write
- products：
- inventory_items：
- suppliers：
- supplier_batches：
- supplier_batch_lines：
- admin_audit_events：

## Image Upload
- 图片源：
- 匹配方式：
- Storage 路径：
- 未匹配处理：

## Model Normalization
- brand：
- model：
- model_codes：
- compatibility_models：
- model_series：

## Execution Flow
- preflight：
- image upload：
- transaction：
- publish：
- audit：

## Verification
- 数量：
- 价格：
- 图片：
- 型号：
- 后台搜索：
- 公开目录：

## Assumptions
- 
```

## 导入完成后的交付说明

最终回复必须说明：

- 写入了多少商品。
- 新建了多少商品。
- 更新了多少已有商品。
- 入库数量合计。
- 成本合计。
- 发布 active 数量。
- draft 待补图数量。
- 是否有待人工处理清单。
- 运行了哪些验证。
- 哪些验证无法执行以及原因。

如果用户要求推送代码，再单独执行 git commit/push；普通导入数据库不等于自动推送代码。
