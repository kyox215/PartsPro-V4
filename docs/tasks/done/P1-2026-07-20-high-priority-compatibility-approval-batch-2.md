# P1-2026-07-20-high-priority-compatibility-approval-batch-2

状态：completed

看板目录：done

优先级：P1

Task ID：TASK-20260720-02

风险等级：R3

自治等级：L1

## 老板原始目标

按照之前待批准的高优先级商品执行，不按表格批量导入；完成后推送。

## 目标与业务影响

逐项审核先前列出的 10 个高库存 Mobilax 多型号商品，把有供应商依据的兼容关系批准到规范化关系表。每个商品继续只有一个 `product.id`、一个 SKU 和一份库存；从任一已批准型号入口下单都扣同一库存。

## 主责与协作

- 主责部门：商品目录部
- 协作部门：采购到货部、仓库库存部、平台发布部、文档审计部
- 工程守门：PartsPro 业务契约、Supabase Migration、安全与发布验证
- Approver：老板（鹤祥）

## 涉及范围

- 数据：`device_models`、`product_device_compatibilities`、`product_supplier_offers`、`products.compatibility_models`
- Migration：`20260719233322_approve_high_priority_mobilax_compatibility_batch_2.sql`
- 审计：当前候选 CSV、批次 2 审核账本、可行性报告
- 生产：`yiuxrjqexlfjtxxrkqvi / PartsPro-V4`

## 批准口径

- 只批准先前明确列出的 10 个 SKU，不把 109 条候选整体上线。
- 供应商商品标题、到货批次、厂家料号或 Mobilax 当前公开目录能明确指向同一零件时，允许批准。
- 型号代码只进入 aliases/model codes，不建立第二份商品或库存。
- `3000000338667` 的 Galaxy A27 5G 因较新到货标题与当前公开商品页不一致，本批继续待审核。
- OPPO `A53s 2020` 不得误写为另一个 `A53s 5G` 型号。

## 批准要求与禁止事项

- 老板已明确批准执行先前待批准批次。
- 必须通过 linked migration history、事务回滚 dry-run、lint/build、SQL 风险扫描和应用后库存 smoke。
- 禁止更改库存、价格、质量等级、上下架状态或订单记录。
- 禁止按相似名称合并不同 EAN/料号商品。
- 禁止批准 Galaxy A27 5G，除非后续取得一致的当前供应商证据。

## 验收标准

- 10 个 SKU 共形成 43 条 approved 兼容关系。
- `3000000166222` 补回 Redmi A2+；`3000000093085` 补回 A53s 2020、A54s、A16s。
- `3000000338667` 只有 5 个 approved 型号，Galaxy A27 5G 为 0 条 approved。
- 每个型号入口返回同一个商品 ID/SKU/库存；没有复制商品。
- 10 个商品应用前后 `stock_qty = available_qty` 且 `actual_qty = available_qty + locked_qty`。
- migration 应用后远端历史、目录视图、供应商映射和审核文档一致。
- 仅提交本任务文件，保留工作区内其他未提交改动。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
npx tsc --noEmit --incremental false
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

另需执行 migration 事务回滚 dry-run、应用后针对 10 个 SKU 的关系数量/共享身份/库存不变量 SQL smoke，以及远端 migration history 核对。

## 完成证据

- linked 项目：`yiuxrjqexlfjtxxrkqvi / PartsPro-V4`，状态 `ACTIVE_HEALTHY`。
- 远端 migration 已按顺序记录 `20260719232814_guard_admin_product_create_permissions` 与 `20260719233322_approve_high_priority_mobilax_compatibility_batch_2`。
- 10 个目标均为 active；5 件组可售库存均为 5，3 件组均为 3，locked 均为 0。
- 应用前 10 个 SKU 的规范化兼容关系均为空；应用后共 43 条 approved，且既有 rejected 关系未被覆盖。
- Mobilax 到货标题/公开目录支持本批 43 条关系；Galaxy A27 5G 保留待审核。

## 验证证据

| Check | 当前结果 | 证据 |
|---|---|---|
| SQL 风险扫描 | passed | 无 drop/truncate/delete、库存/订单 update、grant/revoke 或 policy 改写；只写兼容投影和规范化审核关系 |
| production transaction rollback dry-run | passed | 43 条关系、10 条报价、A27 拦截和库存不变量全部通过，回滚后目标关系仍为 0 |
| CSV parse | passed | 当前候选 117 行/18 列；批次审核 10 行/10 列；当前 pending 109 → 99 |
| `git diff --check` | passed | 本任务范围无空白错误 |
| `npm run lint` | passed | exit 0 |
| `npx tsc --noEmit --incremental false` | passed | build 完成后串行验证 exit 0 |
| `npm run build` | passed | Next.js 16.2.6 production build exit 0 |
| linked project identity | passed | `yiuxrjqexlfjtxxrkqvi / PartsPro-V4`, ACTIVE_HEALTHY |
| migration order gate | passed | 权限迁移先应用并按远端版本 `20260719232814` 对齐；改名前后 SQL SHA-256 一致 |
| production apply / smoke | passed | `20260719233322` 已应用；10 个唯一商品、43 条 approved、10 条 Mobilax offer、A27 approved=0 |
| inventory invariant | passed | 10 个 SKU 的 stock/actual/available/locked 与应用前完全一致，全部满足库存不变量 |
| Supabase advisors | passed with baseline | 本任务对象没有新增安全警告；保留既有未使用索引、多 permissive policy 等项目基线提示 |
| scoped commit / push / Vercel | completed | 仅提交本任务审计、任务卡和 migration；由 main Git 集成发布并在交付结果中记录 deployment |

## 执行结果

- 生产规范化数据累计为 47 个 canonical 设备、57 条 approved、1 条 rejected 和 18 条 supplier offer。
- 当前审核快照剩余 99 条 pending；历史 2,342 条候选仍未批准。
- 本批没有修改商品价格、库存、质量等级、上下架状态或订单。

## 残余风险

- 其余当前 99 条候选和历史 2,342 条候选仍需后续逐批审核。
- 供应商公开页面可能变化；若型号列表或制造商料号变化，应重新进入 candidate 审核，而不是自动改库存身份。
