# P1-2026-07-20-remax-source-catalog-import

状态：done

看板目录：done

优先级：P1

Task ID：TASK-20260720-05

风险等级：R3（生产商品、价格、预购容量与图片写入）

自治等级：L2（可完成整理、预检和安全写入；价格/ETA 不明时不得猜测发布）

## 老板原始目标

根据 `QQ Remax(1).xlsx` 筛选四份 REMAX 报价 PPT 中的商品图片，整理商品与图片匹配关系，把已下单数量作为“待到库存”，客户预购逐笔扣减，直到预购容量不足，并将商品加入首页 REMAX 专区。

## 目标

- 将 Excel 中的正式商品行去重、规范化并与 PPT 商品页/图片建立可追溯映射。
- 将采购数量写入 REMAX 预购批次的 `qty_ordered`/在途容量，不写入真实现货。
- 只对型号、图片、EAN、成本、零售/B2B 价格和 ETA 均通过预检的行开放预购。
- 将安全可发布的商品显示在首页 REMAX 专区；异常行保留为待处理清单。

## 业务契约

`可预购数量 = 已确认采购数量 - 安全缓冲 - 有效预购数量`

- 本批默认安全缓冲为 0，除非老板另行指定。
- 取消有效预购会恢复容量；到货前不增加 `stock_qty`/`actual_qty`/`available_qty`。
- 到货确认后才增加真实库存，并按预购创建时间 FIFO 分配。
- 不使用相似型号图片冒充，不修造可疑 EAN，不将人民币核心价直接当欧元售价。

## 主责与协作

- 主责部门：商品目录部
- 协作部门：采购到货部、价格与客户部、仓库库存部、订单运营部、平台发布部
- 工程守门：供应商到货导入、PartsPro 业务契约、Supabase Migration/RLS、Next.js、前端体验、Vercel

## 涉及范围

- 用户源文件：1 份 Excel、4 份 REMAX PPT。
- 本地输出：商品图片包、商品/图片审计表、REMAX 导入表、异常清单。
- 生产写入：`product-images` Storage、REMAX 预购导入 RPC、首页 REMAX 商品读取。
- 不新增 schema migration；复用已发布的 `20260720002209_remax_preorder_center.sql`。

## 批准要求与硬门槛

- 老板已批准开始整理并加入首页。
- 若零售/B2B 价格规则、人民币到欧元成本口径或 ETA 不可从源文件确认，必须停在导入预检，不得猜测发布。
- 任何远端写入前必须确认 linked 项目、migration history 对齐、现有 REMAX SKU 不冲突，并保留 preview/apply 证据。
- 缺精确 PPT 页面、图片错配、EAN 异常或重复 SKU 的行不得自动发布。

## 验收标准

- 正式行、重复行、异常行数量可追溯到具体 sheet/行号。
- 每个可自动处理商品记录 PPT 文件、页码、媒体文件、图片角色和匹配置信度。
- 导入表 `qty_ordered` 合计与去重后的采购数量一致，`buffer_qty=0`，真实库存保持 0。
- 生产导入后后台 REMAX 汇总数量一致，首页只显示可预购且容量大于等于 MOQ 的商品。
- Excel/PPT 原始文件不被修改；无关未跟踪 PWA 文件不纳入任务提交。

## 验证命令

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

## 执行记录

- 创建：2026-07-20
- 开始：2026-07-20
- 原始数据预检：Excel 正式行 75 行；合并 1 个完全重复后为 74 个商品/颜色规格，采购总数 4,507。
- 图片匹配：19 个精确商品图、38 个同型号共享图、1 个需人工确认的型号别名、1 个需使用包装图、15 个暂无可靠图片；共导出 59 张候选图。
- 数据异常：39 个规格缺 EAN；3 个 EAN 带供应商前后缀，保留原值且未静默改写；`RB-870`/`RB-870HB` 别名待确认；`CB25 240W` 主图标签错误，已改用包装图候选。
- 本地交付：`outputs/remax/REMAX商品与图片匹配清单.xlsx`、`outputs/remax/remax-catalog-data.json`、`outputs/remax/images/` 和 6 张工作表预览。
- 导入安全：后台 REMAX 预览和应用接口新增现有 SKU/EAN 冲突检查；冲突行直接阻止，不再允许静默覆盖线上商品。
- 商城安全：首页改为先读取全部开放预购容量再筛选 REMAX；购物车在结账前阻止现货与预购混单；新增意大利语/中文 REMAX 与预购文案。
- 验证：`git diff --check`、`npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过；本地首页、购物车和未登录后台跳转浏览器 smoke test 无控制台错误。
- 远端门禁：linked migration history 已与 `yiuxrjqexlfjtxxrkqvi` 对齐，`supabase db push --linked --dry-run` 显示远端已是最新。
- 定价确认：1 EUR = 7.75 CNY；到岸系数 `(2487.60 + 442) / 2487.60 = 1.177681`；零售 ×2；B2B ×1.5；ETA `2026-10-01` 至 `2026-12-01`。
- 图片确认：38 个同型号共享图、`RB-870`=`RB-870HB`、`CB25 240W` 包装图均获批准。AA4 的异常 EAN 仍未自动修造，因此保留草稿。
- Storage：已上传并核对 59 个对象到 `product-images/products/imported/external/remax-2026-07/`；公开桶、路径格式和图片加载均通过验证。
- 生产导入：批次 `REMAX-2026-07-A` / `3189c170-2c69-4440-9b0b-f1366abd7282`，创建商品 74、上架 58、草稿 16、采购/待到数量 4,507、预购容量 4,507、批次成本 €11,698.78。
- 库存验证：`stock_qty=0`、`actual_qty=0`、`available_qty=0`、`locked_qty=0`；`incoming_qty=4507`。已开放的 58 个商品可预购数量合计 2,637，剩余 1,870 件属于 16 个未发布草稿。
- 线上 smoke：`https://www.partspro.app/` 已显示 REMAX 专区、8 个首页商品、ETA 和逐 SKU 可预购数；目录可继续分页查看全部上架商品，无控制台错误。
- 图片优先级：发现带 EAN 的 REMAX 路径会被 Mobilax fallback 抢占，已在 `partspro-product-images.ts` 对已批准 REMAX Storage 路径设为优先，待代码发布后生效。
- 完成：2026-07-20
