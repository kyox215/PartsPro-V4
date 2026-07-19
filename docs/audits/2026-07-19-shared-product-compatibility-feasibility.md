# PartsPro 通用商品与共享库存可行性审计

日期：2026-07-19（Europe/Rome）

状态：已完成；生产 migration、代码发布和线上 smoke 均已通过。

目标项目：已复核为 `yiuxrjqexlfjtxxrkqvi / PartsPro-V4`，状态 `ACTIVE_HEALTHY`。

## 结论

方案可行，而且 PartsPro 已经具备核心基础：一个 `products.sku_code` 只对应一个商品，`compatibility_models` 可以让同一商品进入多个型号目录，购物车与订单按同一 SKU 合并、锁定和扣减库存。因此正确方向是“一个商品 + 多个型号入口 + 一份库存”，不是为每个型号复制一条商品后再同步多个库存数字。

现阶段不能直接批量写兼容关系，原因不是库存机制，而是兼容资料仍有自由文本、型号代码污染、跨品牌缺失和供应商解析遗漏。推荐先修查询和编辑契约，再做一批高置信 SKU 试点，最后引入规范化的设备型号关系表。

用户举例中的 `iPhone 8` 与 `iPhone SE 2020` 电池不应合并。两者虽然尺寸和容量接近，但电池连接器不同；当前 Mobilax 历史目录和 UTOPYA 也分别给了不同 EAN/SKU。可用来验证系统的正确样例是两机型共用的屏幕、振动器、扬声器等具体零件。

## 实施结果

- 生产 migration `20260719221153_normalize_product_device_compatibility.sql` 已应用到 `PartsPro-V4`。
- 代码提交 `37e456769727ad17150b059dc98069efa3c9238c` 已部署到 Vercel production；deployment `dpl_82EdBBPbDae3tRxP5sELgv9qne7v` 于 2026-07-20 00:23:10 CEST READY，并接管 `www.partspro.app` / `partspro.app`。
- 新增 12 个 canonical 设备型号、14 条 approved 商品兼容关系、1 条 rejected 负证据关系和 8 条供应商报价映射。
- 首批 8 个商品全部保持原 `product.id / SKU / products.stock_qty / inventory_items`；没有复制商品，也没有改库存数量或订单。
- Mobilax 黑白两款 iPhone 8/SE2 屏、UTOPYA iPhone 12/12 Pro 电池、A52 4G/5G、A15 4G/5G、A13/M13 等入口已验证为同一商品和同一库存。
- iPhone 8 电池 `3667075049470` 到 SE2 的关系明确保存为 rejected；普通后台兼容编辑不能覆盖该负证据。
- A14/A17 的设备代码只进入别名/代码搜索，不再生成伪目录项目。
- 当前候选快照剩余 109 条未批准，历史 Mobilax 2,342 条仍只作为审核底稿，不会自动上线或跨供应商合并。
- 生产 smoke 已确认共享 SKU 在各 approved 型号和 `iPhone SE 2020` 别名入口返回相同库存，目录 `total = returned`；核心页面均为 200，匿名后台 API 仍为 401，部署后 build/runtime/5xx 错误均为 0。

首批逐条决定与证据见 `docs/audits/2026-07-19-shared-product-compatibility-pilot-review.csv`。

## 第二批高优先级批准（2026-07-20）

老板批准执行先前列出的 10 个高库存 Mobilax 待审核商品，而不是按审核表整体批量导入。逐条复核结果已记录在 `docs/audits/2026-07-20-shared-product-compatibility-batch-2-review.csv`：10 个商品可批准 43 条规范化兼容关系，库存动作全部为 `none`。

- `3000000166222` 的到货标题明确包含 Redmi A2+，修复旧解析数组漏项。
- `3000000093085` 的 BLP805 到货标题明确包含 8 个 OPPO 型号，补回 A53s 2020、A54s、A16s；A53s 2020 不等同于另一个 A53s 5G 型号。
- `3000000338667` 只批准公开商品页和早期到货记录一致支持的 A16 4G/5G、A17 4G/5G、A26 5G。最新到货标题新增的 Galaxy A27 5G 与当前公开商品页不一致，本批继续保留待审核。
- 其余 7 个商品按 Mobilax 到货标题、厂家料号和公开目录批准；没有创建第二个商品、第二个 SKU 或第二份库存。
- data-only migration `20260719233322_approve_high_priority_mobilax_compatibility_batch_2.sql` 已通过生产事务回滚演练并正式应用；应用前后都用 SQL 断言保护 `stock_qty = available_qty` 及 `actual_qty = available_qty + locked_qty`。

生产 smoke 已确认本批 10 个唯一商品对应 43 条 approved 关系和 10 条 Mobilax 报价，Galaxy A27 5G 的 approved 数为 0；规范化模型累计实测为 47 个 canonical 设备、57 条 approved 关系、1 条 rejected 负证据和 18 条供应商报价映射。10 个商品的库存值与应用前一致；当前快照待审核数由 109 降至 99，历史 2,342 条候选继续只作为底稿。

## 数据范围和证据边界

本次只读核对了：

- PartsPro 生产库中当前标记为 `Mobilax ChinaTech` 的 4 个到货批次和 `UTOPYA` 的 2 个到货批次。
- 2026-05-25/27 导入、后来将供应商标签脱敏为 `External Supplier` 的 Mobilax 历史目录快照。
- UTOPYA 未登录公开商品页的若干高置信样本。
- 本地 schema、目录筛选、购物车、订单预留和导入脚本。

这不是 Mobilax 或 UTOPYA 的完整实时全目录。首批只读盘点时未访问 Mobilax 官网；第二批在 2026-07-20 对 10 个目标补查了 Mobilax 当前公开商品/分类页面和 PartsPro 到货原文。UTOPYA 仍只核验了当前 69 条商品和少量公开候选。未进入已批准批次的导出项仍是候选，不能跳过技术确认直接批量合并。

## 当前到货商品盘点

| 范围 | 商品数 | 有库存商品 | 库存单位 | 多值兼容候选 | 有库存多值候选 | 候选库存单位 |
|---|---:|---:|---:|---:|---:|---:|
| Mobilax ChinaTech 当前到货 | 550 | 543 | 1,179 | 111 | 109 | 223 |
| UTOPYA 当前到货 | 69 | 67 | 231 | 6 | 6 | 32 |

UTOPYA 的 6 条中，5 条是真正多机型，1 条是把同一型号的别名/代码误当成三个型号。Mobilax 的 111 条仍是候选数，已经发现若干解析污染，必须复核后才能称为确认通用。

当前 619 个两家供应商商品都有 `inventory_items` 行，快照中 `products.stock_qty` 与库存明细的 `available_qty` 汇总没有差异。存在锁货时，`actual = available + locked`，属于订单预留的正常状态。

### Mobilax 当前多型号候选

| 品牌 | 电池 | 屏幕 | 连接器 | Flat/SIM | 合计 | 候选库存 |
|---|---:|---:|---:|---:|---:|---:|
| Apple | 0 | 4 | 4 | 30 | 38 | 43 |
| Honor | 2 | 2 | 0 | 0 | 4 | 7 |
| Motorola | 0 | 4 | 3 | 0 | 7 | 11 |
| OPPO | 8 | 7 | 2 | 0 | 17 | 41 |
| Realme | 0 | 4 | 4 | 0 | 8 | 18 |
| Samsung | 10 | 1 | 6 | 0 | 17 | 50 |
| Wiko | 0 | 1 | 0 | 0 | 1 | 1 |
| Xiaomi | 9 | 8 | 2 | 0 | 19 | 52 |
| 合计 | 29 | 31 | 21 | 30 | 111 | 223 |

当前实物库存中没有明确的多型号摄像头。

### Mobilax 历史目录候选

供应商标签脱敏后的历史目录中共有 17,279 个 Mobilax 来源商品，其中 2,342 条是多值兼容候选。按品牌分布为 Samsung 1,012、Apple 474、Xiaomi 377、Realme 164、OPPO 163、Honor 95、Motorola 43、Vivo 8、TCL 6；按类别分布为 Flat Cable 1,064、摄像头 351、连接器 234、屏幕 225、电池类 197、扬声器 160、后盖 111。

这些候选当前合计只剩 4 个可售单位，且绝大多数为 draft；它们适合做兼容知识底稿，不代表 2026-07-19 的 Mobilax 官网在售或库存状态。电池类还混有电池胶条等附件，必须按真实零件类型二次分类。

### UTOPYA 当前确认项

| EAN / UTOPYA SKU | 商品 | 兼容型号 | 当前库存状态 |
|---|---|---|---|
| `3667075049395` / `627127` | iPhone 12/12 Pro 高容量电池 | iPhone 12；iPhone 12 Pro | actual 10 / available 9 / locked 1 |
| `3667075005933` / `A525INC-ECN@` | Galaxy A52 Incell 屏 | A52 4G A525；A52 5G A526 | available 5 |
| `3667075127079` / `945129` | Galaxy A15 带框 Incell 屏 | A15 4G A155；A15 5G A156B | available 8 |
| `3701569300774` / `A135-EC` | Galaxy A13/M13 屏 | 官网：A13 4G；M13 4G | available 3 |
| `3701569371613` / `A146P-ECN` | Galaxy A14 5G 屏 | A146P；A146U | available 4 |

A13 商品是一个重要解析样本：生产库只记了 A135/A137，但 [UTOPYA 商品页](https://www.utopya.fr/ecran-complet-galaxy-a13-a135fa137f.html) 的兼容字段明确包含 Galaxy A13 4G 和 Galaxy M13 4G。后续抓取必须读取供应商的兼容字段，不能只拆商品标题。

### 正确的 iPhone 8 / SE2 示例

Mobilax 当前已有两条理想示例：

- `3708114088835`：黑色 ESR 屏，`compatibility_models = [iPhone 8, iPhone SE 2nd Gen]`，available 1。
- `3708114088927`：白色 ESR 屏，`compatibility_models = [iPhone 8, iPhone SE 2nd Gen]`，available 1。

每个颜色各自是一条商品和一份库存，但同一颜色商品可以从两个型号目录进入。这正是目标行为。

## iPhone 8 / SE 2020 电池纠正

当前证据一致指向“不通用”：

- PartsPro 当前 UTOPYA iPhone 8 高容量电池是 EAN `3667075049470`、UTOPYA SKU `858742`，available 3，只挂 `iPhone 8`。
- UTOPYA 的 SE2 高容量电池是另一条商品：EAN `3667075049432`、SKU `495022`，官网只标 SE2。[iPhone 8 电池](https://www.utopya.it/batteria-iphone-8-alta-capacita-ti-674.html) 与 [SE2 电池](https://www.utopya.uk/batterie-iphone-se2-2020-haute-capacite-ti.html) 是不同页面和不同 EAN。
- Mobilax 历史目录也将 iPhone 8 电池 `3708083088805` 与 SE 2nd Gen 电池 `3000000037126` 保存为两个不同 SKU。
- `3000000036044` 虽写有 iPhone 8/SE2/SE3，但它是电池胶条，不是电芯。
- iFixit 的拆解测试指出两款电池的尺寸、容量相同，但连接器不同，不能互换。[iPhone SE 2020 拆解](https://www.ifixit.com/Teardown/iPhone+SE+2020+Teardown/133066)

如果店里以后拿到某个明确标注双兼容的第三方电池，应按该具体制造商料号/EAN 录入，并附供应商书面说明或实物测试记录；不能把现有两个供应商 EAN 直接合成一个库存。

## 已发现的数据和业务契约问题

### P1：型号别名与型号代码混在一起

生产数据使用 `iPhone SE 2nd Gen`，静态回退目录使用 `iPhone SE 2020`。目录查询是精确数组匹配，别名不统一会产生重复入口或空结果。

UTOPYA `3667075243373` 是 Galaxy A17 4G 单机型屏，但当前 `compatibility_models` 同时放了 `Galaxy A17 4G A175`、`A175F`、`A17`。后两项应是 `model_codes/aliases`，不是三个设备项目。

后台读取逻辑会把 `model`、`model_codes` 与 `compatibility_models` 合并，编辑时存在把设备代码回写成目录型号的风险：`src/lib/partspro-repository.ts:13004`。

### P1：非 Apple 跨系列筛选会漏商品

Samsung、Xiaomi 等目录选择具体型号时会同时发送 `model` 和 `modelSeries`：`src/components/partspro/catalog-brand-tree.tsx:367`。公共目录先按精确兼容型号筛选，又按商品的单值 `model_series` 过滤：`src/lib/partspro-repository.ts:5220`。一个商品兼容两个不同系列时，可能只在主系列出现。

### P2：跨品牌通用件无法完整表达

`products.brand` 只有一个值，目录先执行品牌精确过滤，再匹配 `compatibility_models`：`src/lib/partspro-repository.ts:5204`。因此：

- `3000000001622` 名称同时包含 Huawei 与 Honor，但现在只挂 Honor。
- `3000000151105`、`3000000202029`、`3000000202050` 名称含 OPPO 与 OnePlus，但只挂 OPPO。
- Xiaomi/Poco 等跨子品牌关系也会被单一品牌入口限制。

### P1：现有 Mobilax 导入脚本不能用于兼容刷新

`scripts/import-mobilax-iphone-catalog.mjs:940` 在 SKU 冲突时会把成本、售价、`products.stock_qty` 和 `inventory_items` 数量重置为 0，并强制 active。它只能作为历史解析参考，绝不能直接重跑来修兼容关系。

### P2：当前候选存在明显解析污染

例如 `3000000034873` 的原名是 Redmi Note 8T/8/8 2021，但兼容数组额外出现 Redmi 6、Redmi Note 7；`3000000050354` 原名含 Poco X3、Mi 10T Lite、Redmi Note 9 Pro，但兼容数组只留下 Poco。批量应用前必须逐条给出证据和审核状态。

## 现有共享库存为何可复用

| 契约 | 当前实现 | 结果 |
|---|---|---|
| 商品身份 | `products.sku_code` 唯一；`compatibility_models` 为数组。`supabase/migrations/20260524090000_baseline_empty_public_schema.sql:62` | 一个实物商品只需一条商品记录 |
| 型号入口 | `catalog_model_options` 展开每条商品的兼容型号。`supabase/migrations/20260525223237_optimize_catalog_model_navigation.sql:27` | 同一商品可进入多个型号目录 |
| 商品筛选 | 精确型号使用 `compatibility_models @> [model]`。`src/lib/partspro-repository.ts:5220` | 两个入口返回同一 product/SKU |
| 购物车 | 以 SKU 建 Map 合并数量。`src/components/partspro/cart-state.ts:565` | 两个入口加入的是同一购物车行 |
| 订单库存 | 预留函数按 SKU `FOR UPDATE`，同时扣商品可售量与库存明细。`supabase/migrations/20260525210756_admin_inventory_order_rpc.sql:188` | 下单任一入口都会扣同一库存 |
| 取消归还 | 按订单行 SKU 和分配记录归还。`supabase/migrations/20260525210756_admin_inventory_order_rpc.sql:276` | 不需要额外的“跨项目同步库存”任务 |

## 方案比较

| 方案 | 优点 | 风险 | 结论 |
|---|---|---|---|
| 每个型号复制商品，再用触发器同步数量 | 表面改动小 | 并发、价格、购物车、订单、取消、批次都会漂移 | 不采用 |
| 继续只用 `compatibility_models text[]` | 同品牌、同系列试点快，无 migration | 自由文本、跨品牌、别名、证据无法治理 | 只用于第一阶段试点 |
| 单一商品 + 规范设备型号关系 + 供应商报价映射 | 能覆盖跨品牌、别名、证据、多个供应商，库存仍只有一份 | 需要 migration、双读过渡和数据复核 | 推荐长期方案 |

## 推荐数据模型

保留 `products` 作为唯一可销售商品和库存身份，新增：

1. `device_models`
   - `id`
   - `brand`
   - `canonical_name`
   - `normalized_key`
   - `aliases[]`
   - `model_codes[]`
   - 唯一约束：`(brand, normalized_key)`

2. `product_device_compatibilities`
   - `product_id`
   - `device_model_id`
   - `source_type`：supplier / manufacturer / teardown / shop_test / manual
   - `source_supplier_id`
   - `source_reference`
   - `confidence`
   - `review_status`：candidate / approved / rejected
   - `verified_by`、`verified_at`、`note`
   - 唯一约束：`(product_id, device_model_id)`

3. `product_supplier_offers`
   - `product_id`
   - `supplier_id`
   - `supplier_sku`
   - `ean`
   - `manufacturer_part_number`
   - `quality_grade`
   - `source_url`、`last_seen_at`

UTO 与 Mobi 的两个商品只有在 EAN、明确制造商料号或供应商书面身份一致时，才映射到同一个 `product_id`。本次 `supplier_batch_lines` 中两家供应商没有任何相同 EAN/主代码交集，因此不能仅凭相似名称自动认作同一个商品。

迁移期间继续维护 `compatibility_models` 作为旧 API 的兼容投影，前端完成双读后再决定是否废弃自由文本数组。

## 分阶段实施计划

### Phase 0：冻结规则与确认样本

- 定义“同一商品”的门槛：相同 EAN/制造商料号，或明确书面兼容证据加人工批准。
- 先确认 10–20 个当前有库存、高销量/高复用候选。
- 把“候选、已批准、拒绝”分开，不让解析结果直接上架。

### Phase 1：先修两个 P1，再做无 schema 试点

- 分离后台的 `compatibility_models`、`model_codes`、别名字段，禁止混写。
- 修复具体型号查询被单值 `modelSeries` 二次过滤的问题。
- 统一 `iPhone SE 2020` / `iPhone SE 2nd Gen` 等 canonical 名称与别名。
- 用 Mobilax iPhone 8/SE2 黑白屏、UTOPYA iPhone 12/12 Pro 电池、A15 4G/5G 屏做试点。

### Phase 2：规范化关系与双读

- 新增 `device_models`、`product_device_compatibilities`、`product_supplier_offers` migration。
- 从现有数组生成候选关系，不自动批准。
- 目录/API 优先读 approved 关系；缺少关系时回退旧数组。
- 后台加入型号选择器、证据链接、置信度和审核状态。

### Phase 3：重复商品合并

- 每个候选输出 dry-run 对照：库存、批次、质量、价格、图片、订单历史、供应商代码。
- 选择 canonical SKU；旧商品先 hidden/alias，不删除历史订单快照。
- 库存只通过受保护 RPC 调整，不直接 update 数量。
- 每批少量应用，应用后核对库存、订单预留和审计事件。

### Phase 4：供应商全量维护

- 获取 Mobilax/UTOPYA 官方 API、CSV 或允许的目录导出。
- 解析供应商兼容字段、EAN、厂家料号与质量等级。
- 新结果只进入 candidate 队列；人工批准后才改变目录入口。
- 定期记录来源更新时间，供应商页面变化时发起复核，不自动拆分或合并库存。

工程实施预计 4–7 个工作日，另加人工核验目录的时间。2,342 条历史 Mobilax 候选不应一次性全审，建议先按“当前有库存、订单频率、通用型号数”排序推进。

## 验收场景

- 从 iPhone 8 与 SE2 目录进入同一黑色屏，返回完全相同的 `product.id`、SKU、价格与库存。
- 从两个入口各加 1 个，购物车只保留一行，数量为 2。
- 库存为 1 时两个并发订单最多成功一个，库存不为负。
- 取消订单后 `products.stock_qty`、`inventory_items.available_qty/locked_qty` 正确恢复。
- Samsung/Xiaomi 跨系列商品在每个 approved 型号入口都可找到。
- Huawei/Honor、OPPO/OnePlus 等跨品牌商品能进入两个品牌目录，但仍只有一个商品和一份库存。
- 型号代码和别名不会生成伪型号项目。
- 两个供应商的相似名称如果 EAN/料号不一致，不会自动合并。
- 后台编辑兼容关系不会改变成本、售价、库存、批次或发布状态。

## 审计附件

- `docs/audits/2026-07-19-mobilax-utopya-multi-model-candidates.csv`：当前两家到货商品的 117 条多值兼容原始候选快照。
- `docs/audits/2026-07-19-historical-mobilax-multi-model-candidates.csv`：2,342 条历史 Mobilax 目录候选；供应商标签已脱敏，不能视为当前官网库存。
- `docs/audits/2026-07-20-shared-product-compatibility-batch-2-review.csv`：第二批 10 个高优先级商品的逐项决定、型号、证据和库存动作。
