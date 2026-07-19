# P1-2026-07-19-shared-product-compatibility-inventory

状态：release_ready

看板目录：now

优先级：P1

Task ID：TASK-20260719-01

风险等级：R3

自治等级：L1

## 老板原始目标

“苹果8的电池和苹果Se2020电池是通过的。我希望我能在苹果8的项目部里找到这个电池并且也能在项目Se2020也能找到这个电池，并且他们是同一个商品、同一个数量。当有人在苹果8的项目里下单一个电池的时候，我需要苹果Se2020的项目里自动扣除掉，是同步的，包括其他品牌和型号。帮我规划下，然后检查下UTO和Mobi看看有哪些商品是通用的，帮我记录下，给我份可行方案先。”

## 目标

建立“一件可销售商品可挂多个品牌/型号入口，但始终只有一个 SKU、一份价格和一份库存”的可审核兼容关系，并安全整理 Mobilax/UTOPYA 通用商品候选。

## 业务影响

减少重复商品、重复采购和库存误判，让维修店按任一适配型号都能找到正确零件，同时保证购物车、订单、锁货、取消和库存审计使用同一商品身份。

## 完成定义

- 规范化型号、别名、型号代码、跨品牌兼容和供应商商品映射已经实现并有 migration 记录。
- 同一商品从任一 approved 型号入口进入时返回同一 `product.id/SKU`。
- 购物车合并、并发下单、订单取消和库存审计通过验收。
- 当前高优先级 Mobilax/UTOPYA 候选已逐条标为 approved/rejected，并保存证据。
- 没有通过相似名称自动合并 EAN、质量或规格不同的商品。

## 主责部门

商品目录部

## 协作部门

仓库库存部、采购到货部、订单运营部、文档审计部

## 工程守门代理

PartsPro 业务契约代理、Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、前端体验代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | 老板（鹤祥） |
| Consulted | 仓库库存部、采购到货部、订单运营部、平台发布部 |
| Informed | 文档审计部 |

## 涉及范围

- 页面：`/catalogo`、`/prodotto/[sku]`、后台商品编辑/审核页
- API：目录筛选、后台商品读写、购物车目录解析、订单 preview/submit
- 数据表/RPC：`products`、`inventory_items`、`supplier_*`、`orders`、`order_lines`、`stock_movements`、拟新增设备型号/兼容/供应商报价关系表
- 文档：本任务卡、审计报告、兼容候选 CSV、migration/runbook
- 外部系统：Mobilax、UTOPYA、Supabase、Vercel

## 已知事实

- 当前同一 SKU 的多型号展示和共享库存基础已经存在。
- 当前 Mobilax 到货商品有 111 条多值兼容候选；UTOPYA 有 6 条，其中 1 条是伪多型号脏数据。
- 当前两家 619 个商品的 product 可售库存与 inventory available 汇总一致。
- 两家当前 `supplier_batch_lines` 没有相同 EAN/主代码交集，不能假设供应商间存在同一商品。
- iPhone 8 与 SE 2020 电池有不同连接器和不同供应商 EAN/SKU，不是本任务的合并样例。
- Mobilax iPhone 8/SE2 黑白屏已经是“一商品、多型号、一库存”的正确样例。
- 现有 Mobilax 导入脚本冲突更新会清零价格和库存，禁止用于本任务。

## 假设与未知项

- 尚未取得两家供应商完整、当前、结构化目录导出。
- 历史解析出的 2,342 条 Mobilax 候选需要技术复核，不能视为已确认。
- 需要老板批准“供应商书面兼容、厂家料号、实物测试”三类证据的优先级。
- 重复商品的实际数量要在规范化后以 dry-run 对照表重新计算。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 商品目录部 | canonical 型号词典、证据等级、首批 10–20 SKU 审核表 | 老板确认规则 | 每条候选有 approved/rejected 和证据 |
| WP-02 | 前端体验 + Next.js | 分离型号/代码编辑，修复别名与跨系列精确筛选 | WP-01 | 现有正确样例可从所有型号入口找到 |
| WP-03 | Supabase Migration 守门 | 型号、兼容、供应商报价关系表及双读 migration | WP-01/WP-02 | dry-run 只包含本任务 migration，安全复核通过 |
| WP-04 | PartsPro 业务契约 | 候选回填、重复商品 dry-run 合并计划 | WP-03 | 无名称自动合并，无库存/订单历史丢失 |
| WP-05 | 订单运营 + 仓库库存 | 购物车、并发下单、取消归还、审计验收 | WP-04 | 全部库存不变量通过 |
| WP-06 | 平台发布部 | Vercel 发布与生产 smoke test | WP-05 | 部署 READY，数据库与 UI 证据一致 |

## 批准要求

- 是否需要老板批准：是；批准兼容证据规则、首批样例、migration 和每批重复商品合并清单。
- 是否需要 Supabase migration 安全门：是。
- 是否需要 Vercel 发布门：是；不能代替 migration。
- 是否需要 PartsPro 业务契约验收：是。

## 验收标准

- 两个型号入口返回相同商品 ID、SKU、价格和库存。
- 两入口各加入 1 个后购物车只有一行、数量为 2。
- 并发下单不超卖，取消后库存完整恢复。
- 跨系列和跨品牌 approved 兼容件在每个入口可见。
- 型号代码、别名不会生成伪目录节点。
- 不同 EAN/制造商料号不会因名称相似被自动合并。
- 后台兼容编辑不改变成本、售价、库存、批次或发布状态。

## 禁止事项

- 禁止为每个适配型号复制商品并同步多个库存数字。
- 禁止仅按相似名称、相同容量或相同外形合并商品。
- 禁止直接 update `products.stock_qty` 或 `inventory_items` 数量。
- 禁止重跑 `scripts/import-mobilax-iphone-catalog.mjs` 刷兼容关系。
- 禁止删除旧商品或历史订单行；先 hidden/alias，并保留审计。
- 禁止跳过 migration dry-run、RLS/grant 审核和 linked 项目确认。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
npx tsc --noEmit
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

另需执行针对性 SQL smoke、购物车/订单 E2E、并发库存测试和取消归还测试。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| linked project identity | passed | `yiuxrjqexlfjtxxrkqvi / PartsPro-V4`, ACTIVE_HEALTHY |
| production compatibility inventory SELECT | passed | Mobilax 550 / UTOPYA 69；候选快照已导出 |
| stock vs available snapshot | passed | 619 商品，0 个 available mismatch |
| cross-supplier exact code overlap | passed | 0 个相同 EAN/主代码 |
| local contract scan | passed with findings | 共享库存基础存在；兼容编辑、系列过滤和跨品牌契约需修复 |
| `git diff --check` | passed | 无 tracked diff 空白错误 |
| CSV parse | passed | 当前候选 117 行 / 18 列；历史候选 2,342 行 / 16 列 |
| trailing whitespace scan | passed | 4 个新增文档/CSV 无行尾空白 |
| TypeScript / lint / build | passed | `npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build` 均为 0 exit |
| production migration apply | passed | `20260719221153_normalize_product_device_compatibility` 已记录在远端历史 |
| schema / RLS / ACL smoke | passed | 3 张表 RLS、3 个 security-invoker view；anon 无写入/RPC 权限，authenticated 无兼容表直写权限 |
| pilot relation seed | passed | 12 devices / 14 approved / 1 rejected / 8 supplier offers |
| shared identity and stock | passed | 8 个试点均为 1 个 product ID；库存不变量 mismatch 0 |
| negative evidence | passed | iPhone 8 电池→SE2 approved 0 / rejected 1 |
| Supabase advisors | passed with baseline/info | security 33→33；仅新增 5 条新索引尚未被真实流量使用的 INFO |

## 执行记录

- 创建：2026-07-19，只读盘点与 proposed 方案
- 批准：2026-07-19，老板明确要求设置目标、开始实施、完成后推送并上线
- 开始：2026-07-19，已进入 R3 工程实施与发布流程
- review：2026-07-20，前端契约与 migration/RLS 双重阻塞复审通过
- verified：2026-07-20，事务回滚、authenticated RPC、生产 schema/库存/API smoke 通过
- released：待执行
- closed：待执行

## 结果

已完成规范化设备/兼容/供应商报价模型、首批高置信回填、目录与后台读写契约修复，并已安全应用生产 migration；待 main 推送、Vercel READY 和线上 smoke 后关闭。详细结论见 `docs/audits/2026-07-19-shared-product-compatibility-feasibility.md`。
