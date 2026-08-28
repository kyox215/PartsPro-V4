# PartsPro 型号归一化 Owner 审批映射包（2026-08-28）

状态：in_progress（Owner 范围批准已完成；48 行 display/search projection、production migration apply 与 scoped main deploy 已授权，Supabase/独立审查/Vercel 门待通过）
生产写入：0
数据快照：PartsPro-V4 / yiuxrjqexlfjtxxrkqvi / 2026-08-28

## 结论

当前菜单读取成功，共 **462** 个非空型号行、**14** 个品牌。canonical 主表共 **223** 个 active device identity。Owner 已批准 48 行高置信 display/search projection、production migration apply 与 scoped main deploy；这不是产品兼容关系批准，也不改变库存、价格、订单或发布状态。194 行 unmatched legacy 与真实 variant 继续 pending，且不在本次授权范围。

修正版生产只读模拟达到：投影 **885** 行、菜单 **417** 行、重复 normalized identity **0**、Samsung A16/A17 菜单 **4** 行、Wiko 前缀显示 **3** 行；9/9 case/punctuation raw/canonical 查询返回完全相同商品集合。A16 5G 查询结果由当前 1 个产品变为模拟 3 个产品，原因是 canonical PDC 商品继承了对应 raw alias，属于预期搜索覆盖扩大。

## 统计

| 指标 | 数量 |
|---|---:|
| 当前菜单型号行 | 462 |
| 品牌 | 14 |
| exact canonical | 220 |
| exact alias | 36 |
| exact model code | 0 |
| case/punctuation primary matches | 9 |
| brand prefix pollution | 3 |
| ambiguous short code | 0 |
| unmatched legacy | 194 |
| code suffix duplicate groups / rows | 39 / 80 |
| case/punctuation duplicate groups / rows | 10 / 20 |
| review_required | 194 |
| inventory_action 非 none | 0 |

`match_type` 是每行的主分类；重复组统计独立计算，不能把各列简单相加。48 行 `exact_alias`/`case_punctuation_equivalent`/`brand_prefix_pollution` 已标记为 `approved`，语义仅限显示/搜索投影；其余 414 行继续 `pending_owner_review`。

## Samsung A16/A17 强证据

| 现有值 | canonical | 处理 |
|---|---|---|
| Galaxy A16 4G A165 / A165F | Galaxy A16 4G | 合并显示，保留代码搜索；官方：[SM-A165F](https://www.samsung.com/ae/support/model/SM-A165FZAIMEA/) |
| Galaxy A16 5G A166 / A166B | Galaxy A16 5G | 合并显示，保留代码搜索；官方：[SM-A166B](https://www.samsung.com/de/smartphones/galaxy-a/galaxy-a16-5g-light-gray-128gb-sm-a166bzadeub/) |
| Galaxy A17 4G A175 / A175F | Galaxy A17 4G | 合并显示，保留代码搜索；官方：[SM-A175F](https://www.samsung.com/pe/support/model/SM-A175FLBKLTP/) |
| Galaxy A17 5G A176 / A176B | Galaxy A17 5G | 合并显示，保留代码搜索；官方：[SM-A176B](https://www.samsung.com/uk/smartphones/galaxy-a/galaxy-a17-5g-grey-128gb-sm-a176bzaaeub/?modelCode=SM-A176BZAAEUB) |

4G 与 5G 是真实不同设备，不得合并。`A16`、`A17` 等短代码如果同时命中多个 canonical，必须保持 `ambiguous_no_auto_map`。

## 数据链路与根因

`catalog_model_options` 由 `catalog_product_device_models` 提供。后者对有 active approved PDC 的商品输出 `device_models.canonical_name`，对没有 approved PDC 的商品直接展开 `products.compatibility_models` legacy 值。菜单视图只按原始 `(brand, model, model_series)` 分组，因此 `Galaxy A16 5G` 与 `Galaxy A16 5G A166` 会被当成两行。前端 `CatalogBrandTree` 只做 trim/精确 Set 去重，不能识别业务别名。

关键文件：

- `src/lib/partspro-repository.ts:2549-2629,14269-14332`
- `src/components/partspro/catalog-brand-tree.tsx:77-85,202-235,684-758`
- `src/lib/partspro-device-series.ts:8-28`
- `supabase/migrations/20260719221153_normalize_product_device_compatibility.sql:579-638,643-722`
- `supabase/migrations/20260720202358_catalog_department_navigation.sql:80-156`


## 本批实现边界与发布授权

- Migration 20260828105427_catalog_model_display_projection.sql 已在 clean worktree 创建，尚未应用。
- 显示投影只在唯一 active canonical/alias/model-code、大小写/标点等价和品牌前缀污染时归一化；A16/A17 的 4G/5G 保持四个 canonical identity。
- alias/model code/raw legacy 值进入搜索 terms，不生成独立菜单行；不写 products.compatibility_models 或 PDC。
- Owner 已授权 48 行 display/search projection 的 production migration apply 与 scoped main deploy，但当前生产写入/迁移/deploy 仍为 0；Supabase linked list/dry-run 已通过，实际 DDL 执行前被平台安全审批拒绝，失败即停止，不提前标记 released。
- 生产 `supabase db push --linked` 未执行任何 SQL；平台要求当前可见用户对敏感生产 DDL 提供直接确认，未采用 MCP 或其他绕过路径。
- exact migration-shape EXPLAIN ANALYZE（当前基线 → 修正版模拟，ms）：projection **4.239 → 6.870**、menu **39.546 → 42.385**、Samsung A16 5G filter **17.001 → 16.769**；未出现首版 345/403/618ms 级别回退。

## Owner 授权与禁止边界

1. 已批准范围仅为 48 行 display/search projection、对应 production migration apply 和 scoped main deploy；显示投影不等于产品兼容关系批准。
2. alias/model code 进入 canonical 的搜索字段，不生成独立菜单行。
3. 4G/5G、Plus/Pro/Ultra/S、年份和代际不得自动合并。
4. 跨品牌 approved 兼容关系保留，不能按商品主品牌删除。
5. 本阶段 `inventory_action` 必须全部为 `none`；不写生产数据库。
6. 194 类 unmatched/legacy 候选、PDC、`products.compatibility_models`、`device_models` 和库存数据修复未授权，不得猜测或进入本批 apply。
7. Supabase/独立审查/Vercel 任一门失败即停止；当前不标记 released。

## 后续修复规划

先完成 Supabase linked list/dry-run、独立审查及 Vercel 发布门；门禁通过后仅 apply 冻结 48 行 view projection，并执行 scoped main deploy。继续保留 194 unmatched；未来如需补 approved PDC 或修改 `products.compatibility_models`/`device_models`，必须另建授权任务，并逐项核对库存、价格、订单、SKU、RLS 和发布状态不变。
