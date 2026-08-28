# P1-2026-08-27-supplier-arrival-cost-v2

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260827-01

风险等级：R3

自治等级：L2

## 老板原始目标

“各个页面还需要优化完善以及功能，比如币种选择等，给我一份完整的需要修复的计划”；经批准后“开始设定目标并执行计划，完成后推送并部署”。

## 目标

在现有供应商到货运输/落地成本功能上，建立以 EUR 为账本基准、支持 EUR/USD/CNY 原币与不可变汇率快照的服务端 V2 合同，并把读取、预览、预估、确认、取消、纠错、历史与导出纳入最小权限和可审计的 API/RPC 流程。

## 业务影响

影响供应商到货批次、库存成本、落地成本、财务成本层、审计和后台运营。错误的汇率、重复确认、越权确认或历史成本重写会造成财务和毛利失真。

## 完成定义

- 仅在本独立 worktree 实现并提交服务端/核心/迁移/契约测试及已批准的到货 UI 改动；主工作区保持不变。
- 现有 EUR 调用和已存在数据兼容；USD/CNY 费用保存原币金额、EUR 基准金额和 rate-to-EUR/date/source 快照，所有分摊和基准合计精确对账。
- read/estimate/confirm/correct/export 权限在 TS、API、RPC 中一致；旧 `supplier_batch.manage_costs` 仅兼容映射，不能独立授予正式确认。
- preview 指纹/版本在 confirm 再校验；预估可取消；确认事实不可更新；纠错保留 reversal/replacement 审计链；已消耗成本层返回财务调整状态并不改历史 COGS。
- list/detail/history/preview/estimate/confirm/cancel/correct/export 具有明确 DTO、稳定错误码和针对性契约测试。
- 通过受影响范围的测试、full lint/typecheck/build、migration 静态安全检查与独立 R3 review；生产 linked apply、push、deploy 必须由主代理按两阶段安全门执行。

## 主责部门

采购到货部

## 协作部门

财务、仓库库存、价格与客户、平台发布、文档审计

## 工程守门代理

Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、Next.js 16 App Router 代理

## RACI

| Role | Owner |
|---|---|
| Responsible | luna_worker / 采购到货部 |
| Approver | 主代理 / 老板 |
| Consulted | 财务、仓库库存、价格与客户、Supabase Migration、Supabase RLS/权限、业务契约、Next.js 代理 |
| Informed | 文档审计、平台发布 |

## 涉及范围

- 页面：后台供应商到货批次列表、详情、运输/到货费用卡片与弹窗、历史/导出入口，以及对应服务端数据合同。
- API：`/api/admin/supplier-batches`、`[batchCode]`、`charges/**`、导出及历史/预览/预估/确认/取消/纠错路径。
- 数据表/RPC：`supplier_batch_charges`、`supplier_batch_charge_allocations`、`finance_cost_layers`、`admin_audit_events`、权限/角色映射及新增 permission-checked SECURITY DEFINER RPC。
- 代码：`src/lib/partspro-permissions.ts`、`src/lib/partspro-supplier-batch-cost-*`、`src/lib/partspro-repository.ts`、`src/app/api/admin/_shared.ts`、`src/app/api/admin/supplier-batches/**`。
- 测试：currency/FX rounding、legacy EUR、权限矩阵、DTO 幂等、preview-confirm stale protection、cancel/correct invariants、migration security/static contract、export fields。
- 外部系统：Supabase migration、Git push 与 Vercel deploy 均必须经过主代理的独立安全门；老板已授权主代理推进，但授权不跳过 linked 目标、dry-run、构建、发布与生产 smoke gate。

## 已知事实

- 当前生产功能以 EUR 为唯一费用币种；`supplier_batches.total_cost` 继续表示商品货值，不含运输。
- 现有费用 migration 已提供估算/确认/取消状态、分摊与成本层兼容逻辑，但尚无完整多币种快照与确认后纠错闭环。
- 生产数据库是敏感 linked 项目 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`；本任务不得连接或写入远端。

## 假设与未知项

- 账本基准固定 EUR；支持的交易币种第一阶段仅 EUR/USD/CNY，不接实时汇率服务。
- FX 由操作员/财务提供并保存 source/date/evidence；EUR rate 固定 1。
- 不得跨币种直接相加：若批次商品货值不是 EUR，EUR 落地总额必须依赖独立、可审计的批次货值 FX 快照；费用 FX 不能冒充货值 FX。缺少批次货值 FX 时，Preview 可展示原币结果，但 Confirm 必须 fail closed 并返回 `BATCH_FX_RATE_REQUIRED`。
- 对已消耗或无法证明未消耗的 finance layer 采用保守阻止并返回 `FINANCE_ADJUSTMENT_REQUIRED`，不自动改写历史 COGS。
- 若远端现有 schema 与本地迁移历史不一致，必须在主代理的 migration 安全门停止，不以兼容猜测代替验证。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | luna_worker | 独立 worktree、任务卡、现状合同矩阵 | origin/main | 状态干净且边界确认 |
| WP-02 | luna_worker | 多币种/FX/权限核心、DTO 与 repository/API | WP-01 | TypeScript/静态合同完成 |
| WP-03 | luna_worker | additive migration、权限检查 RPC、审计/冲正链 | WP-02 设计 | SQL 风险扫描无禁止项 |
| WP-04 | luna_worker | 定向 Node 合同测试和局部 lint/typecheck | WP-02/03 | 受影响验证通过或记录已知基线 |
| WP-05 | 主代理/守门代理 | migration dry-run/apply、push/deploy、生产 smoke 与 post-check | WP-04 且通过独立安全门 | 强制按 stage 1 保留 V1 → 新 app exact commit deploy/smoke → 独立 cleanup migration 撤销 V1 → post-check；主代理执行，不能跳过门禁 |

## 批准要求

- 是否需要老板批准：是；老板已授权主代理推进实现、推送与部署，但不等于跳过生产数据库、发布、权限和真实费用确认安全门。
- 是否需要 Supabase migration 安全门：是；本代理只生成 migration，不执行 linked apply。
- 是否需要 Vercel 发布门：是；由主代理按两阶段顺序执行，仍须通过 exact commit、构建、迁移 dry-run 与生产 smoke。
- 是否需要 PartsPro 业务契约验收：是。

## 验收标准

- [ ] `EUR/USD/CNY` 输入及 FX snapshot 在核心纯函数中保持确定性，原币与 EUR cents 精确对账。
- [ ] 跨币种批次商品货值与费用不直接相加；无独立 batch valuation FX 时 Confirm 返回 `BATCH_FX_RATE_REQUIRED`。
- [ ] 旧 EUR payload/现有数据不需要迁移即可读取；DTO 对服务端 canonical cents 幂等。
- [ ] 管理员具备全部权限；purchasing/pricing_manager 只能 estimate；auditor/finance 按 read/export 映射；旧 manage 不等同 confirm/correct。
- [ ] base list/detail/summary/product hydration 仅接受 `product.read_admin` 或 `products.read_admin`；`supplier_batch.read` 只解锁脱敏 history/correction links，不可单独枚举批次、摘要或商品；runtime 角色授权以 DB mapping 为准，static fallback 仅 P3。
- [ ] API 读取/预览/保存估算/确认/取消/纠错/导出均有权限、状态、幂等、稳定错误码和 preview stale protection。
- [ ] migration 只 additive/可回滚，RPC 固定 search_path、显式 auth/permission check，撤销 public execute 并 grant authenticated/service_role；确认不可更新，取消/纠错审计链完整。
- [ ] `FINANCE_ADJUSTMENT_REQUIRED` 路径不改历史成本层/COGS/销售价/库存数量。
- [ ] 定向 68/68、full lint、Next typegen、tsc、build、diff-check 与 migration 静态扫描结果记录在本任务卡；linked apply/push/deploy 只能由主代理按两阶段安全门执行。

## 禁止事项

- 不修改范围外 UI；本任务已批准的到货列表/详情/运输费用 UI 改动属于交付范围；不触碰主工作区、不清理其他代理改动。
- 本执行代理不擅自执行 `supabase db push --linked`、`apply_migration`、远端 SQL、`db reset`、`migration repair`、`--include-all` 或 production env 变更；主代理仅可在目标、dry-run、风险扫描和构建门全部通过后按两阶段发布。
- 不授予 authenticated 直接读取敏感产品价格列；不把 service role 暴露到浏览器。
- 不使用实时汇率联网依赖；不把运输费写入商品货值，不改销售价/库存数量，不重写历史 COGS。
- 不对已确认 charge 原地 update/delete；不允许旧 preview 或金额变化直接 confirm。

## 验证命令

```bash
node --test tests/supplier-batch-cost-v2-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-dto.test.mjs
npm run lint
npx next typegen
npx tsc --noEmit --pretty false
npm run build
git diff --check
```

```bash
rg -n -i "drop table|truncate|delete from|grant all|security definer|search_path|revoke execute|grant execute" supabase/migrations/<本次新 migration>.sql
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 独立 worktree/branch | passed | `/private/tmp/partspro-arrival-cost-v2-20260827`, branch `codex/supplier-arrival-cost-v2-20260827`, base `de2132b` |
| 规则/Next/Supabase/Postgres 文档读取 | passed | 本执行记录已读取；实现前遵循 Route Handler、RLS、numeric/timezone、短事务与索引要求 |
| 定向契约测试 | passed | `node --test tests/supplier-batch-cost-v2-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-dto.test.mjs`; 68/68 passed |
| Full ESLint | passed | `npm run lint`; 0 errors/0 warnings |
| Next typegen + TypeScript | passed | `npx next typegen` 与 `npx tsc --noEmit --pretty false` 均通过 |
| Production build | passed | `npm run build` |
| Diff whitespace | passed | `git diff --check` |
| Migration 静态风险扫描 | passed with reviewed privileged statements | `rg -n -i "drop table|truncate|delete from|update .*set|grant |revoke |security definer|alter table.*(enable|disable).*row level security|create (or replace )?policy|create (or replace )?function" supabase/migrations/20260827183609_supplier_arrival_cost_v2_currency_fx_permissions.sql`; 未发现 drop/truncate/delete/update 数据回填；命中项仅为显式 RPC `security definer`、RLS/policy、私有函数 revoke 与 authenticated/service_role execute grant，仍需主代理 migration 安全门 |
| 生产只读基线 | passed | charges=0、allocations=0、finance_cost_layers=382、inbound rows=0、inbound total=0、finance total_cost_net=4947.35、supplier_batch_lines=577；V2 RPC/对象在生产缺失（V2 absent） |
| Remote migration ledger (MCP list) | passed | 远端 ledger 最新至 `20260827121835`，无 remote-only divergence |
| Linked CLI dry-run | blocked, no remote effect | CLI profile 缺失且 PAT 已达 20，无法新建长期 token；linked dry-run 未通过，未执行 apply |
| Migration static risk scan | passed with reviewed privileged statements | 仅命中预期 security definer、RLS/policy、revoke/grant；无 drop/truncate/delete/update 数据回填 |
| Independent R3 review | passed | GO；P0/P1/P2=0 |
| migration apply/push/deploy | pending staged release | 老板已授权主代理推进，但必须执行 stage 1 保留 V1 → exact commit deploy/smoke → 独立 cleanup migration 撤销 V1 → post-check；本执行代理未代替主代理跳过安全门 |

## 执行记录

- 创建：2026-08-27，独立 worktree 基于 `origin/main` / `de2132b`
- 批准：老板已授权主代理推进实现、migration/apply/push/deploy，但仍须通过目标、dry-run、风险扫描、构建、权限与生产 smoke 安全门
- 开始：2026-08-27
- 窄修复：删除 core 中未使用的 `readDecimal`，避免新增 ESLint unused-vars 警告；并将 V2 cancel RPC 与 route 的估算兼容权限对齐为允许旧 `supplier_batch.manage_costs`；未改变金额/账本业务逻辑
- 专用最小权限决策：五个 capability 固定为 `supplier_batch.read/estimate/confirm/correct/export`；最终 base list/detail/summary/product hydration 仅接受 `products.read_admin` 或 `product.read_admin`，`supplier_batch.read` 只解锁脱敏 history/correction links，不可单独枚举批次、摘要或商品；预览、估算、取消估算接受专用 `supplier_batch.estimate`，并保留旧 `supplier_batch.manage_costs` 仅作估算兼容；确认只接受 `supplier_batch.confirm`，纠错只接受 `supplier_batch.correct`，费用导出只接受 `supplier_batch.export`；旧 manage 不授予确认/纠错/导出，`finance.*` 不隐式扩大到供应商批次权限；runtime 角色授权以 DB mapping 为准，static fallback 仅 P3
- UI 已修改并纳入交付：批次列表/详情、运输费用弹窗、币种与批次货值 FX、mixed-currency 展示、Preview/历史/导出边界均按上述 DTO 与权限合同适配
- review：独立 R3 review 已通过，GO；P0/P1/P2=0；migration/apply/release 仍由主代理及专项守门代理负责
- verified：四份 supplier-batch 合同测试 68/68、full lint、Next typegen、tsc、build、diff-check 与 migration 静态扫描均通过
- released：pending staged release；尚未执行 production apply/deploy
- closed：pending

## 结果

当前仍为 `in_progress` / `now`。服务端、DTO、API、到货 UI 与契约实现及验证已记录；老板已授权主代理继续推送与部署，但在生产安全门和 smoke 完成前不宣称生产完成，也不移动到 `done`。

残余风险交接：生产只读基线为 charges=0、allocations=0、finance_cost_layers=382、inbound rows=0、`sum(total_cost_net)=4947.35`、supplier_batch_lines=577，且 V2 对象尚不存在；MCP migration ledger 已到 `20260827121835`、无 remote-only divergence。当前 CLI profile 缺失且 PAT 数已达 20，无法新建长期 token，linked dry-run 尚未通过，未执行 apply。主代理须在已确认 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4` 的环境完成目标确认、dry-run、advisors 与构建后，强制按 stage 1 保留 V1 → 新 app exact commit deploy/smoke → 独立 cleanup migration 撤销 V1 → post-check；任何阶段失败均停止，不跳过安全门。
