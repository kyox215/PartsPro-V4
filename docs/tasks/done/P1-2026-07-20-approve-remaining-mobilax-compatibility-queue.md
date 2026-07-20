# P1-2026-07-20-approve-remaining-mobilax-compatibility-queue

状态：done

看板目录：done

优先级：P1

Task ID：TASK-20260720-03

风险等级：R3

自治等级：L1

## 老板原始目标

剩余 99 条当前库存兼容候选全部审批通过。

## 目标与业务影响

把当前 Mobilax 审核队列剩余的 99 个唯一 SKU 转为规范化 approved 关系。每个商品继续只有一个 `product.id`、一个 SKU 和一份库存；不同 approved 品牌/型号入口返回同一商品并共享库存。

老板的批准是审核授权，但旧解析数组不能原样转正：本任务必须以到货商品标题为边界，去除型号代码伪拆分和已知污染，补回标题中被单品牌解析器遗漏的跨品牌/跨系列型号。

## 主责与协作

- 主责部门：商品目录部
- 协作部门：采购到货部、仓库库存部、平台发布部、文档审计部
- 工程守门：PartsPro 业务契约、Supabase Migration、安全与发布验证
- Approver：老板（鹤祥），2026-07-20 明确指令“99条审批都通过”

## 涉及范围

- 99 个唯一 SKU，当前可售库存合计 181；实际库存 182，锁定 1。
- 24 个电池、19 个尾插、30 个排线、26 个屏幕商品。
- 规范化结果：238 条 approved 商品-设备关系，批内涉及 154 个 canonical 设备。
- Migration：`20260720001643_approve_remaining_mobilax_compatibility_batch_3.sql`
- 审核账本：`docs/audits/2026-07-20-shared-product-compatibility-batch-3-review.csv`
- 生产项目：`yiuxrjqexlfjtxxrkqvi / PartsPro-V4`

## 技术复核决定

- 11 个商品按 Mobilax 到货标题纠正旧解析：补回遗漏型号或删除无标题依据的污染型号。
- BN46 `3000000034873` 删除错误的 Redmi 6/Note 7，只批准 Redmi Note 8T/8/8 2021。
- BN5A `3000000096796` 删除错误的 Poco M3，补回 Redmi Note 10 5G。
- `3000000155103` 删除无标题依据的 Honor 5C/7A/8/8 Lite，改为标题明确的 6 个 Huawei 型号。
- `3000000151105` 按标题建立 OPPO、OnePlus、Realme 跨品牌关系。
- Samsung A03 A035F/A035G 与 A13 4G A135/A137 只建立各自一个 canonical 设备，代码保留为 alias/model code。
- Motorola Moto E7 Plus 商品删除由旧代码污染产生的 Moto E7 关系。
- 3 个原“多值候选”在规范化后只有一个真实 canonical 设备，但仍完成审核并进入 managed compatibility。

## 批准要求与禁止事项

- 已获得老板对全部 99 个 SKU 的审批授权。
- 必须先通过 migration history、SQL 风险扫描、事务回滚 dry-run、库存不变量和逐 SKU 关系数量断言。
- 禁止修改库存、价格、成本、质量等级、上下架状态、订单或商品身份。
- 禁止把型号代码当成第二个设备。
- 禁止保留与供应商标题冲突的旧解析污染。
- linked dry-run 如果包含不属于本任务的旧 migration，必须暂停生产应用并取得处理指令。

## 验收标准

- 99 个 SKU 均有规范化 approved 关系，共 238 条，逐 SKU 数量与审核账本一致。
- 99 条 Mobilax supplier offer 与同一商品身份绑定。
- 应用前后 `stock_qty = available_qty` 且 `actual_qty = available_qty + locked_qty`。
- 不创建第二个商品、SKU、库存行或订单动作。
- 跨品牌型号可从正确品牌入口找到同一商品。
- candidate 快照中 pending 从 99 变为 0。
- 仅提交本任务文件，保留 REMAX、PWA 和其他并行工作区改动。

## 当前证据

- 生产库已确认 99/99 个 SKU 存在且 active；没有预先存在的 normalized relation 或 Mobilax offer。
- 当前库存不变量通过：available 181、actual 182、locked 1。
- 154 个批内 canonical 设备 key 无冲突；其中 22 个与生产既有设备一致，canonical 名称无差异。
- 生成结果为 238 条唯一商品-设备关系；没有重复 relation seed。
- 应用前 Supabase 远端最后 migration 为 `20260719233322_approve_high_priority_mobilax_compatibility_batch_2`。
- SQL 风险扫描通过：本次仅写入 canonical 设备、approved 商品-设备关系、Mobilax supplier offer，并更新兼容投影；没有库存、价格、订单、RLS、grant、delete、truncate 或 DDL 变更。
- 生产事务回滚 dry-run 通过；回滚后再次核对为 target relation 0、target Mobilax offer 0、device model 47，证明没有残留生产写入。
- `npm run lint`、`npm run build`、`npx tsc --noEmit --incremental false` 与范围化 `git diff --check` 均通过。

## 完成与发布证据

- 老板明确要求只继续应用本批次后，通过 Supabase migration 接口隔离应用，未执行 REMAX migration。
- 生产 migration `20260720001643_approve_remaining_mobilax_compatibility_batch_3` 已成功进入远端历史。
- 上线后核验：99 个 active 商品、238 条 approved 关系、154 个批内设备、99 条 Mobilax supplier offer。
- 库存上线前后保持一致：available/stock 181、actual 182、locked 1，库存不变量异常 0。
- 两个跨品牌样本分别在 Huawei/Honor 与 OPPO/OnePlus/Realme 入口下返回同一个 `product_id`。
- 99 个 target SKU 没有重复商品身份；没有执行价格、成本、订单、库存、RLS、grant、delete、truncate 或 REMAX 写入。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
npx tsc --noEmit --incremental false
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

已执行 migration 事务回滚 dry-run、应用后 99 个 SKU 的关系/供应商映射/库存 smoke 与 Supabase advisors。代码推送后验证 Vercel production 状态。

## 残余风险

- 历史 Mobilax 2,342 条目录候选仍未审核，不属于本任务。
- 供应商标题变化时应重新审核；不得自动拆分商品或库存。
- 并行 REMAX migration 仍是独立任务，本任务未执行、未提交或修改其业务内容；REMAX 后续必须根据最新远端 migration history 重新通过自己的安全门。
