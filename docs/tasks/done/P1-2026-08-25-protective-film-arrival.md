# P1-2026-08-25-protective-film-arrival

状态：completed

看板目录：done

优先级：P1

Task ID：TASK-20260825-01

风险等级：R3

自治等级：L2

## 老板原始目标

新增保护膜分类，并且本批使用用户明确的自定义售价，后台批次核对不能误报默认 ceil(cost+5) 价格错误。

## Owner 原始规则

- Privacy：`€1.60/片`，每片必须带单独包装。
- 商品名和 `metadata`：只使用意大利语或英文表达，不得包含中文；该限制针对商品名和 metadata 内容，不改变 storefront locale label 的中文翻译。
- 3D：`€1.50/片`；不推断包装方式，只有来源明确声明包装时才记录包装信息。

## 目标

在本地代码中新增 canonical 分类 `Pellicole Protettive`，保留手机目录部门归属，支持保护膜名称归一化，并让供应商批次核对优先使用批次行 metadata 中明确声明的用户售价。

## 业务影响

影响保护膜商品的目录归类、中文/意大利语 storefront 展示、后台到货批次完整性提示和后续批次价格审计。避免 3D 膜与防窥膜使用明确售价时被默认加价规则误报，同时继续发现真实价格错误。

## 完成定义

- 分类 label/value 均为 `Pellicole Protettive`，visual 复用 `screen`，产品默认 `catalog_department` 保持 `phone`。
- `normalizeCategory` 识别 pellicola/pellicole、privacy、protective film(s)、screen protector、tempered glass/tempered-glass、anti-spy，并将 back glass 保持为后盖类。
- 批次脚本和后台批次详情仅在 metadata 明确声明 `price_policy=explicit_user_price`，且 `expected_retail_price`、`expected_b2b_price` 均为 finite 正数时按声明核对；其他批次继续使用 `ceil(cost_price + 5)`。
- 后台批次汇总和 CLI 均要求 inventory row 存在，并核对 `products.stock_qty = inventory.available_qty`、`inventory.actual_qty = inventory.available_qty + inventory.locked_qty` 及商品/库存身份字段一致；不把当前库存与历史到货数量比较。
- 两张已验收图片复制到指定 public 路径，源文件不变。
- 仅完成本地代码、资产和文档；生产写库必须由独立验证后另行批准。

## 主责部门

采购到货部

## 协作部门

商品目录部、价格与客户部、仓库库存部

## 工程守门代理

PartsPro 业务契约代理、文档审计代理

## RACI

| Role | Owner |
|---|---|
| Responsible | luna_worker / 采购到货部 |
| Approver | 主代理 / 老板 |
| Consulted | 商品目录部、价格与客户部、仓库库存部 |
| Informed | 文档审计代理 |

## 涉及范围

- 页面：storefront 分类显示；后台供应商到货批次详情和完整性状态。
- API：现有后台批次详情 repository read path；本地批次完整性验证脚本。
- 数据表/RPC：只读取 `supplier_batch_lines.metadata`、`products` 价格/分类/库存字段和 `inventory_items` 当前账本；本批不执行 Supabase 写入。
- 文档：本任务卡。
- 外部系统：External Supplier；批次 `EXTERNAL-20260825-FILM`。

## 已知事实

- 供应商：External Supplier。
- 批次：`EXTERNAL-20260825-FILM`。
- 来源数据：17 SKU、18 source lines、360 pieces、cost EUR 312。
- 用户明确售价：3D EUR 1.50；Privacy EUR 1.60。
- 预期 metadata 价格策略：`price_policy = explicit_user_price`，并按行写入 `expected_retail_price` 与 `expected_b2b_price`。
- 本批图片目标：`public/generated/product-images/protective-films/privacy.png`、`public/generated/product-images/protective-films/3d.png`。

## 假设与未知项

- 本批 18 条 source lines 的生产数据是否都已携带完整 metadata，须在独立生产只读验证时确认。
- 当前 storefront locale 配置只有意大利语和中文；本地 category label helper 提供 `Protective Films` 英文 fallback，不扩展 locale 配置。
- 生产商品、库存、批次和发布状态未因本任务改变。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | luna_worker | canonical 分类、归一化和 storefront 映射 | 现有字典/数据结构 | 分类与 back glass 定向检查通过 |
| WP-02 | luna_worker | 脚本与后台批次价格核对兼容 | supplier_batch_lines metadata 契约 | 显式价与默认价两条路径均可验证 |
| WP-03 | luna_worker | 图片资产与任务账本 | 已验收源图片 | 目标文件存在、源文件保留、任务卡为 in_progress |

## 批准要求

- 是否需要老板批准：生产写库、库存调整、上架和价格落库需要；本地实现批次不执行。
- 是否需要 Supabase migration 安全门：否，本批不新增或修改 migration。
- 是否需要 Vercel 发布门：否，不推送、不部署。
- 是否需要 PartsPro 业务契约验收：是，价格核对和批次完整性属于强业务契约。

## 验收标准

- `categories` 包含 label/value 完全一致的 `Pellicole Protettive`，visual 为 `screen`。
- `categoryLabel` 具备意大利语 `Pellicole Protettive`、中文 `保护膜` 和英文 `Protective Films` fallback 映射。
- 保护膜关键词及缺分类商品名归一为 `Pellicole Protettive`，`back glass` 缺分类时仍归入 `Back Cover`。
- 显式用户价只在策略标记存在且两个期望价格均为 finite 正数时生效；缺失、零值、负值或其他无效 metadata 时继续检查默认 `ceil(cost_price + 5)`。
- 缺 inventory row、库存恒等式不成立或商品/库存身份字段不一致时，后台批次汇总不得显示 `OK`；后续销售造成当前库存低于历史到货量不作为错误。
- 脚本、后台 repository 和分类逻辑通过定向检查；工作区无超范围修改。
- 图片目标存在且源文件仍存在；没有远端写库、部署或推送。

## 禁止事项

- 不修改 Supabase schema、数据、RPC、Storage 或生产环境。
- 不推送、不部署、不自动创建商品、库存、批次或发布记录。
- 不把 `back glass` 归类为保护膜。
- 不因显式售价 metadata 而跳过其他数量、成本、商品、图片、型号和库存核对。
- 不还原或触碰当前工作区的无关未提交改动。

## 验证命令

```bash
git diff --check
node --check scripts/verify-supplier-batch-integrity.mjs
npm run test:storefront
npm run lint -- src/lib/partspro-data.ts src/i18n/dictionaries/storefront.ts src/lib/partspro-repository.ts scripts/verify-supplier-batch-integrity.mjs tests/supplier-batch-price-contract.test.mjs
```

按逻辑追加：

```bash
node --test tests/supplier-batch-price-contract.test.mjs
```

发布候选阶段追加：

```bash
npm run build
```

本批不涉及公共 schema、migration、API 路由或部署配置。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | passed | 最终重跑 exit 0，无 whitespace 错误 |
| `node --check scripts/verify-supplier-batch-integrity.mjs` | passed | 最终重跑 exit 0，脚本语法检查通过 |
| `node --test tests/supplier-batch-price-contract.test.mjs` | passed | 11/11 行为测试通过：CLI/repository 显式价与 fallback、分类 fallback、Back Glass、当前库存恒等式/身份一致性 |
| `npm run test:storefront` | passed | 6/6 storefront/checkout contract tests passed |
| targeted lint | passed | exit 0：`npm run lint -- src/lib/partspro-data.ts src/i18n/dictionaries/storefront.ts src/lib/partspro-repository.ts scripts/verify-supplier-batch-integrity.mjs tests/supplier-batch-price-contract.test.mjs` |
| TypeScript full check | passed | `npm run build` 的 TypeScript 阶段通过 |
| image source/target check | passed | Privacy SHA-256 `f2306bb5...b73db4`、3D SHA-256 `21897a04...de8c` 与源文件一致 |
| `npm run build` | passed | Next.js 16.2.6 webpack build、TypeScript、18 个静态页面生成和路由收集均通过 |

## 生产交付收尾记录

- prod commit：`8a1b68b7850709f47defacdb6522e54e9f8c45a9`
- Vercel deployment：`dpl_BtLRAXKbryQDrYME5QTNErSUsNgu`，状态 `READY`
- batch：`EXTERNAL-20260825-FILM`
- batch totals：17 products / 18 lines / 360 pieces / 36 boxes / cost EUR 312
- 3D：160 pieces，cost EUR 0.70，sale EUR 1.50
- Privacy：200 pieces，cost EUR 1.00，sale EUR 1.60，individual packaging
- storage hashes：Privacy `f2306bb5...b73db4`；3D `21897a04...de8c`
- rollback dry-run：PASS，无残留
- formal verification：PASS
- `npm verify batch`：OK
- audits：68

## 执行记录

- 创建：2026-08-25
- 批准：主代理验收完成
- 开始：2026-08-25
- review：2026-08-25，本地实现与定向验证完成；2026-08-26，收尾验收完成
- verified：2026-08-26，正式 verification PASS
- released：2026-08-26，prod commit 与 Vercel deployment READY 已记录
- closed：2026-08-26

## 结果

本任务已完成并归档。生产交付与批次验证记录已补充；本批未执行新的生产写库操作。

## 残余风险

- shared type image
- owner-supplied external supplier identity
