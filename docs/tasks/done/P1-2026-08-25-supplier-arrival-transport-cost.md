# P1-2026-08-25-supplier-arrival-transport-cost

状态：completed

看板目录：done

优先级：P1

Task ID：TASK-20260825-02

风险等级：R3

自治等级：L2

## 当前执行状态（2026-08-27）

- 任务已完成并从 `now` 移入 `done`；本节为最终收口证据，历史 apply 前快照仍保留在执行记录中。
- 生产 migration `20260825202034_revoke_supplier_batch_truncate_privileges.sql`、`20260825202035_supplier_batch_transport_costs.sql` 与 `20260827121835` 均已应用到 linked `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`，每次 apply exit 0；post-apply ledger 已对齐，remote-only=0、local-only=0。
- 生产权限 P1 已完成：`has_table_privilege` 与 `aclexplode` 双证据确认 anon/authenticated 的目标 `TRUNCATE` 已撤销，`service_role` 与 owner `postgres` 保留；products 敏感列 ACL 未放宽。
- schema/RLS/RPC/trigger/constraint/execute grants 与 382/382 finance cost-layer backfill/schema/RLS/RPC 独立复核结论为 `GO`；无约束违规，charges/allocations 初始计数为 0。
- 发布链为 commits `27f2097`、`6283258`、`7bb962f`，对应 deployments `dpl_7nm3kHk37LGmvu9s5MREVPSfCHeK`、`dpl_5DWJ6tcEZaMhEn4K3r4fMiRfYwWm`、`dpl_DGxdJipSQxxY3RCAYmw8PyHY8NsF`；最终 `dpl_DGxdJipSQxxY3RCAYmw8PyHY8NsF` 为 `READY`，别名含 `partspro.app`。
- 两次生产 smoke 故障均已修复：products direct 敏感列权限 403 向上游传播为 502，改为安全的 product hydration；cents/euro 双重 normalize 造成金额路径错误，统一单次 normalize 后返回 200/0/0。
- 最终本地验证为 56/56 合同测试、full `npm run lint`、TypeScript 与 Next 16 build 18/18 通过。
- 生产 smoke：列表 20/20，detail card、dynamic chunk、Preview `EUR 1.23`（12 行 = 123 cents）均通过；全部 API 为 200，无应用 4xx/5xx/error。
- DB 不变量保持 `charges=0`、`allocations=0`、`layers=382`、`inbound=0`、`total=4947.35`。未在真实数据上执行 Save/Confirm；mutation 由幂等/合同测试覆盖，未伪造生产写入。
- 残余均为 P3：完整 DOM/fetch mutation test 后补；列表刷新粗测约 8.286s，可另行性能优化；未观察到 `aria-modal`，且按文案 Escape 会丢弃草稿，作为 a11y/UX 观察。两条操作员错误仅来自只读 SQL 日志，不是应用错误且无写入。

## 老板原始目标

“设定目标并开始下一步（基于后台到货运输成本规划）”

## 目标

为后台供应商到货批次建立可审计的运输费用登记、确定性分摊和落地成本规划，形成供本地 schema/RPC、页面/API 实现、数据库迁移和财务核对共同使用的单一业务契约。本轮 G0 已授权本地实现；三份生产 migration 已按独立批准完成 apply 与 post-check，Git/Vercel 发布和浏览器 smoke 也已按独立门禁完成。

## 业务影响

影响供应商到货批次、库存成本、毛利分析、财务成本层和后台运营核对。运输费必须能与商品货值、IVA 和普通经营费用清楚区分，避免库存成本失真、COGS 重复扣减、价格被意外改写或历史成本被直接覆盖。

## 完成定义

- 任务卡状态为 `completed`，并记录本轮老板批准的 G0 与 G1 本地实现状态、范围、契约、验证证据和回滚路径。
- 明确 `supplier_batches.total_cost` 的商品货值语义，以及运输净额、运输 IVA、含税额、可资本化运输成本的分离语义。
- 明确多笔运输费、未登记与 `€0 已确认`、分摊方式、分币处理、幂等、审计和历史 COGS 保护规则。
- 明确第一版不自动改 `products.cost_price`、`retail_price`、`b2b_price`，不直接重写已消耗成本层或历史 COGS。
- 完成本地 WP-02 schema/RPC 批次：新增 migration、权限列表同步和 estimate/preview/confirm RPC 契约；并于 2026-08-27 在独立批准后完成三份生产 migration apply 与应用后核对。
- 完成本地 WP-03 后端与 WP-04 后台读写体验实现，并完成独立复审；生产数据库 schema/RLS/RPC、回填 post-check、浏览器 smoke 与发布门均已完成。
- 生产 migration apply、Git 推送、Vercel production deploy 和 smoke test 均已记录并完成；真实数据上的 Save/Confirm 仍明确未执行。

## 主责部门

采购到货部

## 协作部门

财务、仓库库存、价格与客户、文档审计

## 工程守门代理

Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、Next.js 16 App Router 代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | luna_worker / 采购到货部 |
| Approver | 主代理 / 老板 |
| Consulted | 财务、仓库库存、价格与客户、Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、Next.js 16 App Router 代理、前端体验代理 |
| Informed | 文档审计 |

## 现状与问题

- 现有供应商到货流程要求先只读预检、再按确认声明写库、最后执行批次完整性和审计验证。
- `supplier_batches.total_cost` 必须继续表示批次商品货值，并与 `supplier_batch_lines.line_total` 合计保持现有完整性语义；运输费用不能静默塞入该字段。
- 后台需要同时展示商品货值、运输费用和落地成本，但不能把“运输费尚未登记”误显示为免费，也不能让普通 `shipping` 经营费用与资本化运输成本重复计入。
- 运输费可能来自多张账单、分批到货或不同承运商；单一批次只能有一笔费用的假设不适用。

## 锁定业务契约

### 金额语义

- `supplier_batches.total_cost` 仍为商品货值，不改成含运输费的总额。
- 每笔运输费用独立保存：运输净额、运输 IVA、运输含税额和可资本化运输成本分开记录；币种必须与批次货币和金额精度一致。
- 落地总成本 = 商品货值 + 可资本化运输成本。可抵扣 IVA 是否资本化由财务批准的 VAT 规则决定，不能由前端猜测。
- 运输费不得同时作为落地成本和普通经营费用重复扣减；普通经营费用台账若展示该费用，必须明确其是否已转入资本化成本层。

### 状态和多笔费用

- 费用状态至少区分：`未登记`、`预估`、`已确认`、`€0 已确认`、`需复核`。
- `€0 已确认` 必须是明确选择的供应商包邮、已含货价或自提等原因；不能把空值或未登记解释为免费。
- 一个 `supplier_batch` 允许多笔 `supplier_batch_charges`，每笔可有承运商、费用单号、日期、净额、IVA、含税额、凭证、来源和备注。
- 预估费用可以预览和调整，但未确认不得进入已锁定落地成本；确认后保留原始快照和审计记录。

### 分摊与成本

- 默认按实际到货商品金额占比分摊：分摊基数为实际 `qty_received` 对应的商品行金额，不按订购数量吸收短到货的未发生成本。
- 可选分摊方式：实际到货数量、重量、手工分配；启用重量时必须有可信重量快照，手工分配必须要求逐行金额或比例并通过合计校验。
- 金额统一按币种最小单位计算；采用确定性的分币规则，最后按稳定行顺序吸收余数，所有分摊金额合计必须严格等于该笔可分摊运输成本。
- 每笔分摊保存批次行、分摊比例/权重、分摊金额、实际到货数量/金额/重量快照和舍入调整信息，支持复核而非依赖日后重新推算。
- 第一版不自动修改 `products.cost_price`、`retail_price`、`b2b_price`，不自动改变库存数量、销售价格或上架状态；只提供运输成本和落地单位成本的可审计展示/成本层规划。
- 第一版禁止直接重写已消耗成本层、历史 COGS 或已完成销售的历史成本；历史批次如需调整，必须另建财务调整流程。

### 写入、幂等和审计

- 已新增并应用 `supplier_batch_charges` 和 `supplier_batch_charge_allocations`，并扩展 finance cost layer breakdown；schema、字段、索引、兼容策略已通过 migration、RLS 和业务契约独立复核。
- 多表确认写入必须通过短事务 RPC，使用稳定幂等键，保证重试不重复生成费用、分摊、成本层或审计事件。
- 确认必须写 `admin_audit_events`，至少记录批次、费用、金额语义、分摊方式、快照、操作者、原因、来源凭证和幂等键；事务失败不得留下部分确认状态。
- 三份生产 migration 的 apply 已按老板独立批准完成；本任务卡不扩大该批准范围，Git push、Vercel deploy 和生产浏览器 smoke 均按独立发布门完成，且未借此授权真实数据 Save/Confirm。

## 涉及范围

- 页面：后台「供应商到货批次」列表金额摘要；批次详情/抽屉的运输与落地成本卡片；批次行的原始成本、分摊运输费和落地单位成本；费用预览、预估保存、确认并锁定、复核状态和权限提示。
- API：现有批次只读查询的扩展；运输费预览接口；受权限保护的确认/锁定接口或 Server Action；导出字段扩展；最终接口契约须经 Next.js 16、业务契约和 RLS 守门审查。
- 数据表/RPC：已落实 `supplier_batch_charges`、`supplier_batch_charge_allocations`、finance cost layer breakdown、短事务 RPC、RLS 和审计契约；确认写入使用已复核的短事务 RPC。
- 文档：本任务卡、批准记录、migration/runbook、财务成本口径和后续交付/回滚记录。
- 外部系统：供应商运输发票/账单和凭证作为来源证据；Supabase 三份 migration 已通过生产批准门并完成 apply，Vercel 发布与 smoke 也已按独立发布门完成。

## Out of Scope

- WP-02F 初始本地批次不连接 linked、不 dry-run remote、不应用 migration；该阶段已结束。2026-08-27 后续独立批次已按安全门完成三份生产 migration apply 与 post-check；发布已由独立 Git/Vercel 门完成，本卡不把 migration 记录扩展为真实数据写入授权。
- 不导入具体运输发票、不确认任何真实批次费用、不调整库存、不重算已售商品成本、不回填历史 COGS。
- 不自动改 `products.cost_price`、`retail_price`、`b2b_price`，不改变客户等级、价格策略、订单、checkout、付款、退款或供应商结算。
- 不把运输费默认当作零、不把 IVA 规则硬编码成税务结论、不设计跨仓库或跨批次的高级成本重估流程。
- 本卡不新增生产费用确认、库存或价格写入，也不修改环境变量；Git/Vercel 发布及其 smoke 证据见下方，且未在真实数据上 Save/Confirm。
- 后续后台 UI、Route Handler、Server Action、客户端数据访问和测试属于已授权的本地工作包，但不在 WP-02F 本批文件范围内，须按 WP-03 至 WP-06 的工作包和审查记录推进。

## 已知事实

- 到货导入规则要求先只读预检，确认声明与预检不一致时立即中止；每次写库必须有批次、商品行、库存增量和审计证据。
- 当前到货完整性语义要求批次商品数量和商品成本分别与行项目合计核对；运输费需要作为附加成本域单独建模。
- 当前后台已有供应商到货批次工作区，本任务预期扩展批次详情/金额区域，不新增独立顶级导航。
- 运输成本与库存估值、COGS、普通经营费用存在财务交叉影响，因此按 R3 处理并需要财务、仓库库存和 PartsPro 业务契约参与。
- 当前 worktree 存在大量其他用户/代理未提交改动；本任务各子批只修改明确列出的文件，不回退、覆盖或格式化无关改动。
- 本轮本地 migration 由 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration new supplier_batch_transport_costs` 创建，文件名由 CLI 生成。

### `finance_cost_layers` 与旧成本字段 writer matrix（2026-08-27 只读复核）

| Writer | 写入形态 | 旧字段边界 | 结论 |
|---|---|---|---|
| `20260701210603_admin_finance_ledger.sql` | 初始/同步 supplier-batch layer，写入 `unit_cost_net`/`total_cost_net` | legacy goods-only shape；由 supplier-batch compat trigger 映射 breakdown | 未发现未受保护的 landed-cost writer |
| `20260720002209_remax_preorder_center.sql` | `admin_receive_remax_preorder_batch` receipt upsert，写入旧成本字段 | receipt goods cost；由 supplier-batch compat trigger 保留 inbound breakdown | 未发现未受保护的 landed-cost writer |
| `20260825202035_supplier_batch_transport_costs.sql` | transport confirm RPC 更新/插入 cost layer | 有意将旧字段写为 goods + confirmed inbound 的最终 landed/COGS 值，同时保存三列 breakdown | 本目标 writer，符合已锁定契约 |
| `src/lib/partspro-repository.ts` | cost-layer 查询与 DTO 读取 | 不写入 `finance_cost_layers` 或旧成本字段 | 只读 |

矩阵边界：当前仓库未发现 transport 目标 migration 之外、绕过兼容触发器而把旧字段当作最终 landed cost 的应用 writer；非 supplier-batch layer 继续保持原有语义，不由本 migration 猜测或重写。生产 schema/RLS/RPC/trigger 已完成独立 post-check 并为 `GO`；浏览器/API smoke 已按发布门完成。

## 假设与未知项

- 当前远端 Supabase linked 目标、迁移历史、真实表结构、RLS、RPC 和财务成本层字段已在 apply 前后按只读核对与 post-check 复核；后续 schema 变更仍不得以本地文档替代远端真相。
- 财务尚未批准运输 IVA 的可抵扣/不可抵扣资本化口径；在批准前只记录净额、IVA、含税额和待定的可资本化成本，不自动推导税务结论。
- 是否支持重量分摊取决于批次行是否有可靠重量来源；缺失或不可信时必须禁用该方式或转人工复核。
- 现有库存成本层是否能记录运输 breakdown、已消费数量、未消费库存和成本调整，需要由业务契约、财务和数据库守门代理确认。
- 历史批次的运输费补录、分批到货/部分入库、退货、贷项通知单、汇率和跨币种费用属于需在方案审查中确认的边界。
- 本地 migration 已锁定 `estimated`/`confirmed`/`cancelled` 和本地权限/RPC 契约；凭证存储路径、财务审计扩展字段和 UI 呈现仍需后续业务/文档审查确认。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 业务与财务口径 | 采购到货部、财务 | 金额字段、VAT、资本化、普通费用去重和历史 COGS 规则 | 本任务卡、现有导入/财务文档 | 财务与 PartsPro 业务契约守门代理确认口径，未决项有记录 |
| WP-02 数据与权限设计 | Supabase Migration 守门代理、Supabase RLS/权限代理 | charge、allocation、成本层 breakdown、兼容触发器、索引、RLS、短事务 RPC、fingerprint 和幂等设计 | WP-01；本地现有 schema/权限只读核对；独立审查 | WP-02F 本地最终微调、生产 apply/post-check 与独立复审完成；Git/Vercel 发布与 smoke 已完成 |
| WP-03 成本计算与批次契约 | PartsPro 业务契约代理、仓库库存、财务 | 多笔费用、实际到货基数、数量/重量/手工分摊、确定性分币和成本层映射 | WP-01、WP-02 | 单元/SQL 例子覆盖零费用、短到货、分币、重复确认、历史 COGS 保护 |
| WP-04 后台读写体验 | Next.js 16 App Router 代理、前端体验代理 | 列表摘要、详情卡片、预览/确认/复核状态、权限和错误显示 | WP-02、WP-03 | 页面/API 契约、加载/失败/重试/无权状态和移动密度通过定向检查 |
| WP-05 导入与运行文档 | 采购到货部、文档审计 | 到货声明扩展、凭证/运输费预检、导入后验证、runbook 和审计字段 | WP-01 至 WP-04 | 文档与代码/schema/远端状态一致；生产费用确认保持未执行，Git/Vercel 发布和 smoke 已按独立门禁完成 |
| WP-06 受批准实现与验证 | luna_worker；各工程守门代理 | 本地实现、定向测试、migration dry-run、生产 apply/post-check 证据 | WP-01 至 WP-05、Owner Gate | 已通过批准的验证集合；Git/Vercel 发布和浏览器 smoke 已完成，真实 Save/Confirm 未执行 |

WP-03 当前执行状态：本地后端批次已完成 core/Repository/API/export 的静态合同实现与 15/15 Node 合同测试；WP-03R2 已关闭本轮 4 项 P1 并补齐可执行 preview/estimate/confirm/cancelled、summary、persisted fact 和 export helper fixtures；WP-03R3 进一步冻结真实 migration-shape preview 的根级 metadata 缺失语义、RPC allocation 必填字段和 5001 行上限 helper 事实；生产数据库执行级验证与 post-check 已完成并为 `GO`。

WP-04 当前本地执行状态：只读成本卡、Preview、Save estimate、Confirm，以及字段错误、unknown-write、严格 readback、超时/重试和权限状态机均已完成并独立复审；客户端 DTO 复用 core summary/charge normalizer，读写仍以服务端回读更新正式状态。`costSummary: null`、畸形 charges、畸形 line costs 和无效 `weightGram` 均保持 fail-closed；生产 schema/RLS/RPC/migration、浏览器 smoke 与发布验证均已完成，真实数据 Save/Confirm 未执行。

## 风险

- R3 财务风险：IVA 或资本化口径错误会污染库存估值、毛利和 COGS。
- R3 数据风险：费用与分摊多表写入部分成功、重复提交或舍入不一致会造成批次成本无法对账。
- R3 历史风险：直接重写已消耗成本层或历史 COGS 会改变已完成销售的财务事实。
- R3 权限风险：普通后台用户可能确认、锁定或修改金额；RLS、RPC 和审计边界不足会造成越权。
- R2 业务风险：把未登记解释为免费、把短到货按订购数量分摊或错误使用重量会导致单位成本失真。
- R2 体验风险：列表摘要、详情、导出和财务展示口径不一致，运营人员可能重复录入或误判批次状态。
- R2 依赖风险：生产 schema、迁移历史、现有 cost layer、linked project、浏览器/API smoke 与 Vercel 发布状态均已完成复核；剩余项降级为 P3 观察。

## 批准要求

- 是否需要老板批准：本轮 G0 已批准进入 G1 本地实现；三份生产 Supabase migration apply 已于 2026-08-27 获得独立批准并完成，Git push、Vercel 部署与 smoke 也已分别通过发布门。
- 是否需要 Supabase migration 安全门：需要；任何新增/修改 migration 必须由 Supabase Migration 守门代理收尾，并完成 linked project、remote-only divergence、dry-run、风险扫描及 lint/build 门禁。
- 是否需要 Supabase RLS/权限审查：需要；涉及 charge、allocation、cost layer、RPC、审计和后台确认权限。
- 是否需要 Vercel 发布门：需要；数据库 apply 已独立完成，Vercel 发布不得替代或隐含该批准，本次已通过 Git/Vercel 与 smoke 门。
- 是否需要 PartsPro 业务契约验收：需要；运输金额、库存成本、价格保护、COGS 和普通费用去重属于强业务契约。
- 是否需要独立审查：需要；本任务为 R3，涉及财务、库存、持久化、权限和跨模块接口；本地独立复审、生产 schema/RLS/RPC/post-check、浏览器 smoke 与发布验收均已完成且无 P1，剩余为 P3。

## 迁移安全门

本轮已完成 WP-02F 的本地 schema/RPC 最终微调与静态审查，并在独立批准后完成 linked migration apply。以下条件构成已通过的 migration 安全门，后续 schema 变更仍须重新满足：

- linked project 明确为 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。
- `supabase migration list --linked` 无 remote-only divergence；`supabase db push --linked --dry-run` 只列出本任务产生的 migration。
- dry-run 不夹带旧 pending migration；不使用 `--include-all`、`--include-seed`、`migration repair`、`db pull` 或 `db reset --linked`。
- SQL 风险扫描确认无破坏性 `drop/truncate/delete`、危险 grant/revoke、RLS/policy 重写、auth/storage 权限重写或生产回填；仅允许本 migration 已说明的受控 finance breakdown backfill、窄域兼容触发和当前批次成本层重建。
- RPC 具备短事务、权限校验、稳定幂等键、金额合计约束、审计事件和失败回滚；RLS/权限代理和业务契约代理已签字。
- `npm run lint`、`npm run build` 及受影响范围测试通过；本次三份 migration apply exit 0，应用后 ledger、ACL、schema/RLS/RPC、回填和日志核对均为 `GO`。

本批创建 `supabase/migrations/20260825202035_supplier_batch_transport_costs.sql` 时未连接 linked；2026-08-26 至 2026-08-27 apply 前的 connector/CLI 记录均为历史门禁证据，已由最终生产 apply/post-check 记录取代。2026-08-27 已完成持久 CLI 登录、linked history、dry-run、三份 migration apply 与应用后核对。

历史记录（截至 2026-08-26；已于 2026-08-27 解除/被新证据取代，不再作为当前 blocker）：TASK-20260826-01 已解除既有 starter/admin-dashboard TypeScript baseline，独立复审无 P1/P2；全量 `npm run lint` 与 `npm run build` 均通过。该日 linked 只读核对因 CLI 两次 exit 1、未提供 access token 而为 `NO-GO`；随后 connector fallback 已确认 remote-only 为无、local-only 仅为目标 migration，但当时 dry-run 尚未执行；本段只保留历史状态，不代表当前 CLI 或 dry-run blocker。

历史快照（P1 权限 migration 重排前，已被最终证据取代）：本轮随后使用已连接的 Supabase connector `list_migrations(project_id=yiuxrjqexlfjtxxrkqvi)` 做只读 fallback，并将完整远端集合与本地 `supabase/migrations/*.sql` 的版本+名称集合比较：远端 103 条、本地 104 条；`remote-only`：无；`local-only`：`20260825202035_supplier_batch_transport_costs`；同版本名称不一致：无；同名称版本不一致：无。该证据仅覆盖当时的 transport 草案；connector 历史列表仅是 migration history 对比，不是 `db push --linked --dry-run`；CLI list 仍两次认证失败，dry-run 未执行，整体 migration gate 当时为 `NO-GO`，远端未写，apply 继续关闭。

历史快照（截至 2026-08-27，权限 migration 重排前，已被最终证据取代）：CLI 2.101.0 登录成功；project-ref 精确为 `yiuxrjqexlfjtxxrkqvi`；`supabase migration list --linked` exit 0，remote-only 无、local-only 仅 `20260825202035_supplier_batch_transport_costs`；`supabase db push --linked --dry-run` exit 0，Would push 仅当时的 transport 草案，明确未 push。该历史证据不覆盖新增的 `20260825202034` 权限 migration；重排后的两份 migration 必须重新执行只读 history/dry-run。旧 CLI token 缺失/未执行 dry-run 记录已被本证据取代，connector 不替代 dry-run，远端未写，apply 仍关闭。

2026-08-27 只读 schema/RLS 预检补充证据（apply 前历史记录）：运输成本 migration 目标对象无漂移；既有 finance cost-layer 回填候选 382/382 均满足候选条件；模拟回填后约束违规数为 0。另确认现存 `public.supplier_batches` 与 `public.finance_cost_layers` 存在直接表级 `TRUNCATE` grants，RLS 不保护该权限，已登记为 P1 紧急任务 [P1-2026-08-27-table-truncate-grants](../done/P1-2026-08-27-table-truncate-grants.md)。该 P1 随后完成最小权限处置并通过应用后验证，当前 apply gate 已关闭并转入发布门。

## 验收标准

- 任务卡状态为 `completed`，Task ID、P1/R3/L2、主责/协作/守门角色与老板目标完整可追溯。
- `supplier_batches.total_cost` 的商品货值语义被明确锁定；运输净额、IVA、含税额和可资本化成本不混用。
- 规则覆盖多笔运输费、未登记与 `€0 已确认`、预估与确认、实际到货金额/数量/重量/手工分摊、确定性分币和严格合计相等。
- 第一版明确禁止自动修改 `products.cost_price`、`retail_price`、`b2b_price`，禁止直接重写已消耗成本层/历史 COGS，禁止普通经营费用重复扣减。
- 新增 migration 定义 `supplier_batch_charges`、`supplier_batch_charge_allocations`、成本层 breakdown、仅 supplier-batch layer 生效的旧 writer 兼容触发器、父批次删除 restrict 和跨批次约束、短事务 RPC、payload fingerprint、manual snapshot、RLS 和审计事件；保存预估不写正式 allocations/cost layers，confirmed 记录不可原地编辑。
- `admin_preview_supplier_batch_charge(text,jsonb)`、`admin_save_supplier_batch_charge_estimate(text,jsonb,text)` 和 `admin_confirm_supplier_batch_charge(text,jsonb,text,text)` 均有权限、幂等、短事务/锁、完整 charge 快照、line projection 和返回 revision 契约；preview 提供机器可读 `confirmationBlockCode=FINANCIAL_ADJUSTMENT_REQUIRED`。
- compat truth table 明确覆盖：非 supplier layer 原样返回；supplier INSERT legacy/显式 breakdown；UPDATE breakdown/legacy total/legacy unit/received-only；`qty=0` 与正 inbound 明确拒绝或保留可解释单位成本；preview revision 前后相等才返回；VAT treatment/confidence 按现有 finance 语义映射。
- `admin_list_supplier_batch_cost_summaries(uuid[])` 为集合聚合只读 RPC：输入去重、最多 500 个、仅返回存在批次且无费用批次也有摘要；提供 goods/estimated/confirmed/cancelled/landed/projected、confirmationBlocked、reviewCodes 和优先级稳定的 costStatus。
- charge/allocation SELECT RLS policy 覆盖 `supplier_batch.manage_costs`；preview/result 明确 candidate/confirmed/effective allocation 字段（estimated 为候选、confirmed 为正式、cancelled 不产生 effective 分摊），`lineProjections` 仅保留 `current*`、`projected*`、`inboundAfterCandidate` 等不暗示历史最终值的字段；关键失败路径具有稳定 SQL `DETAIL` codes。
- 权限 `supplier_batch.manage_costs` 已同步到 `admin_permissions`、admin/purchasing/pricing_manager 模板和本地 TypeScript 权限集合。
- 工作包、风险、验收、禁止事项、迁移安全门、回滚、残余风险和 Owner Gate 完整；本地实现按子批文件所有权执行。
- 没有本任务范围外的库存、产品价格或费用确认写入；三份生产 migration apply、Git push、Vercel deploy 和浏览器 smoke 均已记录完成，真实数据 Save/Confirm 未执行。

## 禁止事项

- 不将本卡的 migration apply 记录单独扩展为库存、价格或费用确认写入授权；Git push、Vercel deploy 与 smoke 必须遵守各自独立门禁，本次实际发布证据不得替代未来写入审批。
- 不把 `supplier_batches.total_cost` 改为含运输费总额，不用运输费覆盖商品行成本，不以 UI 成功代替数据库/审计验证。
- 不把空白/未知运输费当作 `€0 已确认`，不按订购数量分摊实际未到货商品，不忽略分币余数或允许分摊合计不相等。
- 不把同一笔运输费同时计入落地成本和普通经营费用，不直接重写历史 COGS、已消费成本层或已完成销售事实。
- 不绕过 RPC、RLS、幂等和审计；不通过客户端暴露 service role 或敏感密钥。
- 不修改或还原其他用户/代理未提交改动；WP-02F 只修改本任务 migration 与任务卡，不再触碰权限文件。

## 验证命令

本批仅运行允许范围内的本地验证：

```bash
git diff --check -- src/lib/partspro-permissions.ts
git diff --no-index --check /dev/null docs/tasks/now/P1-2026-08-25-supplier-arrival-transport-cost.md || test $? -eq 1
git diff --no-index --check /dev/null supabase/migrations/20260825202035_supplier_batch_transport_costs.sql || test $? -eq 1
git diff --no-index --check /dev/null supabase/migrations/20260825202034_revoke_supplier_batch_truncate_privileges.sql || test $? -eq 1
npm run lint -- src/lib/partspro-permissions.ts
rg -n -i "drop table|truncate|delete from" supabase/migrations/20260825202035_supplier_batch_transport_costs.sql
rg -n "admin_list_supplier_batch_cost_summaries|grant execute|revoke all on function|create policy|supplier_batch.manage_costs|candidateAllocationTotal|confirmedAllocationTotal|allocationTotal|lineProjections|inboundAfterCandidate|currentLanded|projectedLanded|cumulativeConfirmedInbound|finalLanded|confirmationBlockCode|DETAIL|FINANCIAL_ADJUSTMENT_REQUIRED|CHARGE_IMMUTABLE|CHARGE_CANCELLED|IDEMPOTENCY_CONFLICT|STALE_REVISION|CHARGE_NOT_FOUND|BATCH_NOT_FOUND|admin_receive_remax_preorder_batch|insert into public\.finance_cost_layers|on conflict \(supplier_batch_line_id\)|finance_cost_layers_supplier_batch_compat|supplier_batch_line_id is null|on delete restrict|manualAllocations|revision_before|revision_after|esclus|included|estimated|unmatched" supabase/migrations/20260825202035_supplier_batch_transport_costs.sql supabase/migrations/20260720002209_remax_preorder_center.sql
git status --short
git diff -- docs/tasks/now/P1-2026-08-25-supplier-arrival-transport-cost.md src/lib/partspro-permissions.ts
```

WP-03 本地后端批次的限定验证：

```bash
node --test tests/supplier-batch-transport-cost-contract.test.mjs
npm run lint -- src/lib/partspro-supplier-batch-cost-core.mjs src/lib/partspro-repository.ts src/app/api/admin/_shared.ts src/app/api/admin/finance/_shared.ts src/lib/partspro-supplier-batch-files.ts src/app/api/admin/supplier-batches/export/route.ts 'src/app/api/admin/supplier-batches/[batchCode]/charges/_schemas.ts' 'src/app/api/admin/supplier-batches/[batchCode]/charges/preview/route.ts' 'src/app/api/admin/supplier-batches/[batchCode]/charges/estimate/route.ts' 'src/app/api/admin/supplier-batches/[batchCode]/charges/confirm/route.ts' tests/supplier-batch-transport-cost-contract.test.mjs
git diff --check -- src/lib/partspro-repository.ts src/app/api/admin/_shared.ts src/app/api/admin/finance/_shared.ts src/lib/partspro-supplier-batch-files.ts src/app/api/admin/supplier-batches/export/route.ts
git diff --no-index --check /dev/null src/lib/partspro-supplier-batch-cost-core.mjs || test $? -eq 1
git diff --no-index --check /dev/null src/lib/partspro-supplier-batch-cost-core.d.mts || test $? -eq 1
git diff --no-index --check /dev/null 'src/app/api/admin/supplier-batches/[batchCode]/charges/_schemas.ts' || test $? -eq 1
rg -n -i "drop table|truncate|delete from|delete[[:space:]]+from" src/lib/partspro-supplier-batch-cost-core.mjs src/lib/partspro-repository.ts src/app/api/admin/_shared.ts src/app/api/admin/finance/_shared.ts src/lib/partspro-supplier-batch-files.ts src/app/api/admin/supplier-batches/export/route.ts 'src/app/api/admin/supplier-batches/[batchCode]/charges'
git status --short
git diff --stat -- src/lib/partspro-repository.ts src/app/api/admin/_shared.ts src/app/api/admin/finance/_shared.ts src/lib/partspro-supplier-batch-files.ts src/app/api/admin/supplier-batches/export/route.ts
```

WP-02F 初始本地 migration 批次不运行 Supabase linked/remote CLI/MCP、migration dry-run、远端 SQL、local DB reset、Vercel 命令或部署；该阶段已结束。WP-03 与 WP-04 已完成本地合同测试、全量 lint 和静态检查，生产三份 migration apply/post-check、真实浏览器联调与 Git/Vercel 发布门均已完成。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 上一批任务卡 untracked no-index whitespace check | passed | no-index clean diff 预期 exit 1 已接受；无 whitespace 错误 |
| 上一批 `git status --short -- docs/tasks/now/P1-2026-08-25-supplier-arrival-transport-cost.md` | passed | 显示新增任务卡 `??`，其他 dirty 改动未触碰 |
| `git diff --check -- src/lib/partspro-permissions.ts` | passed | exit 0；本命令只覆盖当前 tracked permission 文件；两个 untracked 文件另以 no-index check 覆盖 |
| `git diff --no-index --check /dev/null <new file>` | passed | 对两个 untracked 文件分别执行；clean whitespace check 的 no-index 差异返回 1 已显式接受，whitespace 错误返回 2 不被吞掉 |
| `npm run lint -- src/lib/partspro-permissions.ts` | passed | exit 0；权限文件本批未再修改，局部契约仍通过 |
| migration 静态风险检查 | passed with controlled updates | 无 `drop table`、`truncate`、`delete from`；受控 backfill、窄域 compat trigger 和当前批次 cost-layer update/insert 已人工核对 |
| WP-02R2 compat truth table / 旧 REMAX upsert核对 | passed static; DB 未执行 | 非 supplier layer 原样返回；supplier INSERT legacy/显式、UPDATE breakdown/legacy total/unit/received-only、qty=0 正 inbound 拒绝均有分支；旧 `admin_receive_remax_preorder_batch` 省略 breakdown 时只在旧 cost 字段改写分支重建 goods，received-only 不重复计入 inbound |
| WP-02R2 FK/manual/revision/VAT rg核对 | passed static; DB 未执行 | charge/allocation 父 batch FK 为 `on delete restrict`；preview/save/confirm 按 incoming method 处理 manual snapshot，preview 有 revision before/after；新 layer VAT treatment/confidence 映射 excluded/exact、included/unknown estimated、zero/unmatched |
| WP-02R3 summary/RLS/response/detail 静态核对 | passed static; DB 未执行 | `admin_list_supplier_batch_cost_summaries(uuid[])` 去重并限 500，原始数组也在 unnest 前限 500，集合聚合保留无费用批次；status/reviewCodes 优先级、`FINANCIAL_ADJUSTMENT_REQUIRED`、RLS manage-costs closure、summary grants/revokes、candidate/confirmed/effective allocation 字段和稳定 DETAIL codes 已核对 |
| WP-02R3 trigger/projected-line 人工核对 | passed static; DB 未执行 | 显式 breakdown 的 goods_unit 与 goods_total/received_qty 不一致直接拒绝；projection 使用 left join product，保留 current/projected 与 `inboundAfterCandidate`，移除 `cumulativeConfirmedInbound`/`finalLanded*`；缺 mapping 到货行不静默消失 |
| WP-02F 最终微调与独立复审 | passed static; DB 未执行 | preview block code 统一为 `FINANCIAL_ADJUSTMENT_REQUIRED`；三个 trigger existence check 分别限定 `tgrelid` 到目标 relation；独立最终复审无 P1，G1 本地静态审查通过并完成，可进入 WP-03 |
| `git status --short` / `git diff` | passed | 允许文件为任务卡、CLI migration 和既有权限文件局部增补；其他 dirty-worktree 改动保留；新增文件保持 `??`，未 stage |
| WP-03 `node --test tests/supplier-batch-transport-cost-contract.test.mjs` | passed | 8/8 通过；覆盖 cost status、畸形数据 null、整数分币、qty=0 unit null、多 confirmed、route/schema/RPC/export/pagination 源契约 |
| WP-03 targeted `npm run lint -- <batch files>` | passed | exit 0；目标 TS/JS 文件通过，后续 core warning 已清理；未运行 full lint/build |
| WP-03 tracked/untracked whitespace 与 destructive scan | passed static | tracked 目标以 `git diff --check` 检查；新增 core/schema/test 以 no-index whitespace 检查；源范围未发现 destructive SQL 关键字 |
| WP-03 repository/API/export 静态契约 | passed static; DB 未执行 | caller-scoped charges/allocations 读取按 100 IDs/1000 分页；RPC wrappers 固定 metadata 并隔离 DB message/hint；三路由权限/Zod/async params；summary/confirmed cost 与 charges export 采用批量 hydrate，无 detail N+1 |
| WP-03R fail-closed/auth/export 修复 | passed static; DB 未执行 | 成本列表/详情/导出全路径不再调用 service-role lookup；charge/summary/allocation 枚举、EUR、ID、金额/状态关系和 allocation 快照异常整批失败；goods cost 严格按 `round(qty_received * unit_cost, 2)`；导出分页至 5000 硬上限并显式拒绝超限，lines 输出 `cost_status` 与 confirmed-only landed 字段 |
| WP-03R client-safe schema/core 实测 | passed | 新增 client-safe Zod schema 与类型声明；Node 合同测试实测非法 enum、非 EUR、缺 ID、manual fallback 约束、矛盾 unrecorded、畸形 charge、`qty*unit` 与 `line_total` 分叉及负分币；目标 ESLint 通过 |
| WP-03 `npx tsc --noEmit --pretty false` 观察 | baseline failed; not gate | 仅报告既有 `exports/partspro-framework-kit-2026-08-24/starter`、`src/components/partspro/admin-dashboard.tsx` 类型错误；未命中本批文件 |
| WP-03R2 core/RPC fixture 实测 | passed | preview allocation 缺 metadata 归一为 `{}`，metadata 非 object 拒绝；summary 严格 landed 恒等式/count=0 规则；persisted allocation 要求三 UUID、metadata object、合法 numeric/rounding；RPC candidate/effective/confirmed 逐行映射和 A/B swap 拒绝；14/14 Node 合同测试通过 |
| WP-03R2 export scope/row-limit helper | passed static + executable helper | `supplierBatchExportRowCount` 按 batches/lines/charges 最终行数计数；Repository charges scope 只 hydrate batches+charges，lines scope 才 hydrate lines/products/inventory/allocations；分页按短页终止并在输出前统一 5000 行拒绝；helper 已纳入 Node 合同测试 |
| WP-03R2 target lint/TypeScript observation | passed target; baseline full tsc failed | core/repository/files/export route/test 目标 ESLint exit 0；完整 `npx tsc --noEmit --pretty false` 仅命中既有 exports/starter 与 admin dashboard 基线错误，未命中本批文件 |
| WP-03R2 whitespace/destructive scan | passed static | tracked `git diff --check` exit 0；4 个本轮 untracked 文件分别以 no-index check 检查且无 whitespace 输出（差异预期 exit 1）；目标源码 destructive scan 无 `drop table`/`truncate`/`delete from`；未执行 DB/build/deploy |
| WP-03R3 core/RPC runtime fixture 实测 | passed | preview 根级省略 metadata 归一为 `metadata: null`，显式非 object 拒绝；preview allocation 缺 metadata 仍归一为 `{}`；RPC allocation 要求非空整数 `lineNo`、非空 `weightGramSnapshot`、非空 `landedLineCost`/`landedUnitCost` 且 `qty_received > 0`；estimate/confirm 完整正向 fixture 与 A/B swap 反例通过 |
| WP-03R3 export helper fixture 实测 | passed | `supplierBatchExportRowCount` 对最终 lines/charges 各 5001 行均返回 5001，证明超限判断输入不会被 helper 静默截断；Repository 413/分页与数据库返回形状仍为静态合同，未执行数据库 |
| WP-03R3 target validation | passed target; baseline full tsc failed | Node 合同测试 14/14、允许文件 ESLint exit 0、tracked/untracked `git diff --check` 无 whitespace 输出、目标源码 destructive scan 无命中；完整 tsc 仅命中既有 exports/starter 与 admin dashboard 基线错误，未命中本批文件；未运行 migration、linked/remote、build/deploy |
| WP-04A `node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs` | passed | 6/6 通过；使用 core summary fixtures 验证 unavailable/unrecorded 空白、confirmed_zero €0、estimated projected 及 confirmed+estimated 分离；静态检查 parser fail-closed、权限、charges export、只读接线和 charge status 语义 |
| WP-04A `node --test tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-price-contract.test.mjs` | passed | 25/25 通过；后端运输合同与既有价格/批次合同均未回归 |
| WP-04A targeted `npm run lint -- src/components/partspro/supplier-batch-transport-cost-card.tsx src/components/partspro/admin-products-panel.tsx src/i18n/dictionaries/admin.ts tests/supplier-batch-transport-cost-ui-contract.test.mjs` | passed | exit 0；目标 TSX/TS/测试通过 |
| WP-04A 定向复审修复 `node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-price-contract.test.mjs` | passed | 33/33 通过；新增跨批次 summary/charge 归属、双权限、manage-only、`canRead=false`、列表不重复货值与 qty/舍入恒等式可执行断言 |
| WP-04A `npx tsc --noEmit --pretty false` | baseline failed; not gate | 仅命中既有 `exports/partspro-framework-kit-2026-08-24/starter` 和 `src/components/partspro/admin-dashboard.tsx` 类型错误，未命中 WP-04A card/panel/dictionary 文件 |
| WP-04A whitespace check | passed | tracked 目标 `git diff --check` exit 0；card 与 UI 合同测试以 `git diff --no-index --check /dev/null <file>` 检查，均无 whitespace 输出（新增文件差异预期 exit 1） |
| TASK-20260826-01 baseline closure `npm run lint` | passed | 2026-08-26 全量 lint exit 0；既有 starter/admin-dashboard TypeScript baseline 已解除，独立复审无 P1/P2 |
| TASK-20260826-01 baseline closure `npm run build` | passed | 2026-08-26 `Next 16.2.6 (webpack)` 编译、TypeScript 检查和 18/18 静态页生成均完成；无运输成本文件错误 |
| 历史 baseline 失败记录状态 | resolved | 上述此前各 WP 记录中的 starter/admin-dashboard baseline failure 均保留为当时观察，已于 2026-08-26 由 TASK-20260826-01 解除；不删除历史证据 |
| 2026-08-27 本地权限 migration 生成（apply 前） | passed locally | 使用 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration new revoke_supplier_batch_truncate_privileges` 生成 `supabase/migrations/20260825202034_revoke_supplier_batch_truncate_privileges.sql`；该条为 apply 前历史记录 |
| 2026-08-27 权限 migration SQL 静态风险检查（apply 前） | passed locally | 可执行 SQL 仅含两条精确 `REVOKE TRUNCATE`：supplier_batches 针对 anon/authenticated，finance_cost_layers 针对 authenticated；未触碰 service_role/postgres 或其他权限，未含 grant/cascade/DDL/DML |
| 2026-08-27 运输合同测试 | passed | `node --test tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-transport-cost-ui-contract.test.mjs` 33/33 通过 |
| 2026-08-27 运输目标 ESLint | passed | transport API/routes、card/dialog、cost core/schema/files 目标 ESLint exit 0；本次未修改这些应用文件 |
| 2026-08-27 `git diff --check` | passed | exit 0；新增权限 migration 的 whitespace 亦以 executable-SQL/no-index 核对，无 whitespace 输出 |
| 2026-08-27 production migration apply | passed | linked target 精确为 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`；`supabase db push --linked` exit 0，仅应用 `20260825202034` → `20260825202035`，未使用绕过参数 |
| 2026-08-27 post-apply migration ledger | passed | apply 后 `supabase migration list --linked` exit 0，remote-only=0、local-only=0，local/remote 完全对齐 |
| 2026-08-27 ACL/schema/RLS/RPC/backfill post-check | passed / GO | `has_table_privilege` 与 `aclexplode` 双证据确认 anon/authenticated 目标 TRUNCATE=false，service_role/postgres 保留；schema/RLS/RPC/trigger/constraint/execute grants 独立复核 GO，382/382 backfill 候选无约束违规，charges/allocations 初始计数为 0 |
| 2026-08-27 final local validation | passed | React lazy-load commit `006159fbcaa0ead39681031b8b805dd545de9776`（`006159f`）；运输合同 34/34、全量 `npm run lint` 和 `npm run build` 均通过 |

## 回滚方案

- 本批文档回滚：若老板拒绝或调整口径，只删除/移至正确任务目录或在审阅后修订本任务卡；不得触碰其他文件、代码、数据库或用户改动。任何删除/移动动作须由主代理确认。
- 后续本地实现回滚：按文件级 patch 回退新增 UI/API/计算逻辑，保留任务卡、审计和批准记录；不使用 `git reset --hard` 或覆盖其他改动。
- 后续 migration 回滚：优先采用向前兼容的撤销 migration/feature flag 和停止确认入口；应用前必须提供备份/快照、反向 SQL 演练和数据影响评估。若已产生确认费用或成本层，禁止直接删除事实记录，改用受批准的反向调整和审计事件。
- 若验证发现成本/COGS 已被错误影响，立即停止确认入口，保留原始费用与分摊快照，通知财务和主代理，按财务批准的调整流程修复；不直接批量覆盖历史数据。

## 残余风险

- 财务 VAT、资本化和普通经营费用映射在财务签字前仍未最终确定。
- 生产 schema、RLS、RPC 和 cost layer 已完成 apply 前后独立核验并为 `GO`；浏览器/API smoke 已完成。
- 历史批次、部分入库、退货、贷项通知单、跨币种和已售/未售成本分层需要单独业务决策。
- 重量来源、手工分摊权限、凭证存储和多币种汇率证据可能扩大第一版复杂度；未批准前保持为未知项。
- WP-02R3 migration 已在生产执行并完成 schema/RLS/RPC/trigger/constraint 独立 post-check；数据库级门为 `GO`，浏览器/API smoke 已完成，财务 VAT 口径仍按残余 P3 规则处理。
- 父批次删除 restrict、`qty=0` 正 inbound 拒绝、preview revision 前后竞争窗口和手工快照恢复已纳入生产 RPC/约束核对；VAT/confidence 映射仍需财务最终确认。
- 独立最终复审未发现 P1；summary RPC 的 reviewCodes/status 优先级、RLS permission closure、candidate/confirmed/effective 字段和 SQL DETAIL codes 的生产核对为 `GO`，线上入口 smoke 已完成。
- 旧 REMAX/预售占用层仍是 estimate-only/需财务调整；确认 RPC 对 `allocated_qty > 0` 或 `consumed_qty > 0` 强制阻止，不实现历史调整。
- WP-04 本地表单、Preview、Save estimate/Confirm API 接线和错误/unknown-write/readback 状态机已实现并有合同测试；真实 RPC/RLS/migration 已通过 post-check，浏览器 smoke 已完成，真实数据 Save/Confirm 未执行。
- WP-03R 已将成本路径读错误改为不向 API 暴露 Supabase 原始 message/detail；生产 post-check 已覆盖 PostgREST 行形状、RLS caller-scoped 访问、RPC allocation 快照和导出 5000 行上限，浏览器/联调证据已补齐。
- 既有 starter/admin-dashboard TypeScript baseline 已于 2026-08-26 由 TASK-20260826-01 解除并独立复审无 P1/P2；当前剩余风险集中在财务口径与本卡列明的 P3 a11y/UX/性能观察。
- P2-01：既有 `finance_cost_layers` 回填与约束兼容性已完成生产核对，无违规；后续财务调整仍走独立流程。
- P2-02：本次手工 schema 漂移已通过 apply 前后对比；后续 schema 变更仍须重新核对。
- P2-03：三个同名 trigger 检查已在本地 migration 限定各自目标 `tgrelid`，生产对象存在性与执行级核对已通过，后续变更仍需回归。
- P2-04：历史成本归入 goods 语义仍需财务核对，不能仅凭 migration 或 dry-run 推导会计结论。
- P2-05：dry-run 本身只证明待应用 migration 集合；本次真实 RLS、RPC、约束和触发器已由独立 post-check 覆盖。

## Owner Gate

当前 Gate：`G0 / 业务口径与任务立项`，状态 `approved`；`G1 / 本地 schema-RPC 与后端契约实现`，状态 `completed (local static review passed)`；WP-03 后端本地实现、WP-04 后台读写、数据库执行、linked migration apply、应用后核对、浏览器验收与 Git/Vercel 发布均已完成，任务状态为 `completed/done`。

主代理/老板需要确认：

1. 本轮老板目标“设定目标并开始下一步”已作为 G0 本地实现批准记录；本批准覆盖本地 schema/RPC 与本地页面/API 实现。生产 migration apply 已由独立 Owner 批准并完成；Git push、Vercel deploy 与线上 smoke 另经独立发布门完成。
2. 是否接受本卡锁定的商品货值、运输金额、分摊、IVA、价格保护和历史 COGS 规则。
3. 财务是否指定可资本化运输成本与可抵扣 IVA 的具体口径。
4. 本轮 WP-04 本地读写体验与独立复审已完成；2026-08-27 CLI 登录成功，`migration list --linked` 与 `db push --linked --dry-run` 均 exit 0，随后三份生产 migration 已获独立批准并 apply exit 0，应用后 ledger、ACL、schema/RLS/RPC 与回填 post-check 均为 `GO`。2026-08-27 schema/RLS 预检另确认直接表级 `TRUNCATE` P1，详见 item 5；真实浏览器/API smoke 与 Git/Vercel 发布已完成。
5. 2026-08-27 只读 schema/RLS 预检确认目标对象无漂移、382/382 回填候选模拟回填后 0 约束违规；同时确认 `public.supplier_batches` 与 `public.finance_cost_layers` 的直接表级 `TRUNCATE` P1，详见 [P1-2026-08-27-table-truncate-grants](../done/P1-2026-08-27-table-truncate-grants.md)。该 P1 已完成最小权限处置并通过应用后修复验证，详见已完成任务卡；当前不扩大 revoke 范围。

生产 migration apply、应用后核对、Git push、Vercel production deploy 和 smoke test 均已完成；老板的视觉/业务修正可重新打开已通过的 Gate，并须在任务卡执行记录中留痕。

## 执行记录

以下条目按时间顺序保留分阶段历史快照；其中“待执行/未执行/关闭”仅描述当时状态，最终状态唯一以文首“当前执行状态”、Owner Gate 和“最终结果”为准。历史生产 smoke 故障已在最终发布链中修复并通过 smoke 验收。

- 创建：2026-08-25，由 luna_worker 根据主代理派单创建
- 批准：2026-08-25（历史快照），老板目标批准 G0 本地实现；生产 migration/远端写库/push/deploy 当时仍关闭
- 开始：2026-08-25，完成任务卡立项并开始 G1 WP-02 本地 schema/RPC 实现
- WP-02：已生成并填写 CLI migration；已同步本地权限列表/模板；限定验证已通过，待主代理审查
- independent review：发现 4 项 P1 与 P2/P3 契约缺口，已纳入 WP-02R：finance breakdown 兼容、preview block、fingerprint/manual snapshot、revision/product lock、EUR/显式 capitalized、audit metadata、RPC-only/跨批次约束和多笔费用 projection
- independent review WP-02R2（历史快照）：复审剩余 4 项 P1/P2——supplier-layer-only compat truth table/qty=0、父批次删除 restrict、incoming-method manual fallback + preview revision stability、VAT/confidence finance 语义映射——已在本轮处置；当时 G1 尚待数据库执行级验证与最终复审，后续已完成
- WP-02R：修订本地 migration；待 Supabase Migration/RLS/PartsPro 业务契约复审
- WP-02R2（历史快照）：完成 migration 与任务卡窄域修订；当时未执行数据库，后续已完成执行级 smoke/最终复审
- review：WP-02R2 待数据库执行级验证/最终复审
- WP-02R3：冻结批量摘要 RPC、RLS 闭包、allocation 响应字段（estimated 候选、confirmed 正式、cancelled effective 为空）、projection 缺 mapping 保留、稳定错误 detail codes 和显式 breakdown 单元一致性拒绝；未执行数据库，待独立复审/执行级验证
- review（历史快照）：WP-02R3 独立接口复审已完成；无 P1，数据库执行级验证当时仍待后续门禁；G1 本地静态审查通过并完成，后续执行级验证已完成
- WP-02F（apply 前历史）：统一 preview block code、清理 projection 误导字段、收窄 compat trigger existence check、补 summary 原始数组上限；当时未连接 linked、未应用 migration
- final review（apply 前历史）：独立最终复审无 P1；G1 本地静态审查完成，可进入 WP-03；数据库执行、linked 应用和发布当时仍关闭
- verified（apply 前历史）：限定 whitespace/rg/人工核对已通过；数据库执行级验证及远端 migration/release 验证当时尚未执行
- WP-03：已在本地新增 client-safe cost core 与 `.d.mts`，窄改批次 Repository（summary/charges/allocations/line/product 分页读取、confirmed line cost 聚合、RPC wrappers、批量 export hydrate），提升公共 `parseAdminJsonBody` 并由 finance shared re-export；新增 preview/estimate/confirm 路由、严格 Zod schema、charges 导出 scope 和 Node 合同测试。未改 UI/i18n、migration、linked/remote、库存或价格。
- WP-03 verification：Node 合同测试 8/8 通过；目标文件 ESLint 通过；全量 `tsc --noEmit` 未作为本批 gate（只观察到既有 exports/starter 与 admin dashboard 类型错误）；数据库/RPC 未执行。
- WP-03R：独立审查 P1/P2/P3 处置完成：成本相关读取统一 caller-scoped；core 对 charge/summary/allocation 采用 fail-closed 严格枚举、EUR、ID、金额/状态关系、快照和 signed rounding；货值改用 migration 同口径 `round(qty_received * unit_cost, 2)`；lines export 明确 unavailable/unrecorded/confirmed_zero/confirmed；summary/export 采用 500 分块与全量分页、5000 硬上限；错误只使用 SQLSTATE + exact detail code；新增 client-safe Zod schema 与实测合同用例。未执行数据库、linked/remote、build/deploy。
- WP-03R verification：Node 合同测试 11/11 通过；目标文件 ESLint 通过；tracked/untracked whitespace 检查通过；目标文件 `tsc` 无错误，完整 TypeScript 观察仍受既有基线错误影响；destructive scan 未执行 SQL/命令写入；数据库/RPC 未执行。
- WP-03R2：关闭 4 项 P1：RPC preview allocation 与 persisted allocation 分离严格度；summary 精确 landed 恒等式与零计数金额约束；persisted fact UUID/metadata/numeric/confirmed actor/fingerprint fail-closed；RPC candidate/confirmed/effective 与 lineProjection 逐行一致性和重复 line 防护。补齐合法 preview/estimate/confirmed/cancelled、非法 enum/非 EUR/缺 ID、矛盾 summary、非法 persisted fact、负 rounding、qty×unit 分叉、A/B allocation swap 和 export scope/row helper fixtures；未改 migration、UI/i18n、linked/remote、数据库。
- WP-03R2 verification：Node 合同测试 14/14 通过；core/repository/files/export route/test 目标 ESLint 通过；完整 `npx tsc --noEmit --pretty false` 仍只受既有 exports/starter 与 admin dashboard 错误影响，未命中本批文件；数据库/RPC/build/deploy 未执行。
- WP-03R3：仅修正本地 cost core/.d.mts/合同测试/任务卡：真实 migration-shape preview 根级 metadata 缺失输出 `null`，显式非 object fail-closed；RPC allocation 与 SQL 返回契约收紧为非空 lineNo/weight/落地行成本/落地单位成本且数量大于 0；类型改为 preview `charge:null`/`metadata:null` 与 persisted charge/metadata 的判别联合；补完整 estimate/confirm 正向断言及 lines/charges 各 5001 行 helper fixture。未改 repository/export 实现、migration、UI/i18n、linked/remote、数据库。
- WP-03R3 verification：Node 合同测试仍 14/14 通过（包含新增 root metadata、allocation strictness、estimate/confirm 和 5001 行 helper 断言）；允许文件目标 ESLint exit 0；完整 tsc 仍仅受既有 exports/starter 与 admin dashboard 错误影响，未命中本批文件；tracked/untracked whitespace 与目标源码 destructive scan 通过；数据库/RPC/build/deploy 仍未执行。
- WP-04A：新增运输与落地成本只读卡片及 compact summary/line display helpers；批次列表把成本摘要并入原金额格，详情接入已确认和预估显示，费用状态/复核提示/承运商/参考号/日期展示，charges CSV/Excel 导出仅对 `supplier_batch.manage_costs` 暴露；line DTO 校验 batchLine identity 与 landed 恒等式；未新增任何写 API 调用或表单。
- WP-04A verification：UI 合同测试 6/6、后端运输合同与价格合同 25/25 通过；目标 ESLint exit 0；完整 tsc 仅有既有 baseline 错误且未命中 WP-04A 文件；tracked/untracked whitespace check 通过；未运行浏览器、数据库、migration、build、linked/remote 或 deploy。
- WP-04B1：在既有只读卡片接线上新增供应商费用新建/预估编辑表单的本地输入与 Preview 交互；严格复用 `supplierBatchChargePreviewSchema.safeParse`，保留 EUR、幂等键、手工分摊快照、重量提示、零成本原因和确认阻止提示；本步不调用 estimate/confirm、不写入数据库、不做乐观成本更新。
- WP-04B1 verification：`node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-price-contract.test.mjs` 39/39 通过；对话框与 UI 合同目标 ESLint 通过；完整 `npx tsc --noEmit --pretty false` 仍仅命中既有 exports/starter 与 admin dashboard 基线错误，未命中本批对话框/合同测试；tracked/untracked whitespace 检查无 whitespace 输出；未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy。
- WP-04B1 review fixes：关闭 P1 行身份伪标识（detail/dialog/manual/preview 均保留并展示真实 `lineNo` + `skuCode`，name 仅作辅助），补 evidence URL `http`/`https` 白名单与安全字段错误映射，修正错误原子清理和 Field/手工输入 `aria-describedby` 连接；加入 `AbortController`、25 秒超时、关闭/外部关闭/卸载失效请求保护与重复预览防护；落地单位按 zh/it EUR 四位小数显示并区分 null/真实 0；对话框对非 `estimated` charge fail-closed 只读；移除卡片技术 permission badge 和“无编辑表单”文案。仍仅调用 preview，不进入 estimate/confirm，不持久化。
- WP-04B1 review verification：UI/运输 core/routes/价格合同 `node --test` 40/40 通过（UI 15/15）；目标 dialog/card/UI test ESLint exit 0；完整 `npm exec -- tsc --noEmit --pretty false --incremental false` 仍仅命中既有 exports/starter 与 admin dashboard baseline 错误，未命中本批文件；4 个目标文件 no-index whitespace check 无输出（新增文件差异预期 exit 1）；补充了行标签、URL 协议、四位单位、字段错误替换/清理与 non-estimated guard 的可执行 helper/source contract。无 DOM integration 测试依赖，因此 abort/close 生命周期以精确源契约覆盖；未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy。
- WP-04B1 final P2 closure：共享 `supplierBatchChargePreviewSchema`、`supplierBatchChargeEstimateSchema` 与 `supplierBatchChargeConfirmSchema` 均在 base evidence URL 字段拒绝非 HTTP(S) 协议并返回稳定 `EVIDENCE_URL_HTTP_REQUIRED`，继续保留 trim/url/2048 上限；预览与正式行成本统一复用 card 的 EUR 四位 unit formatter（null 为 `—`，真实 0 保留四位）。
- WP-04B1 final P2 verification：UI/运输 core/routes/价格合同 `node --test` 41/41 通过（新增三套 schema 对 http/https、javascript/ftp/data、缺省/null 的真实 `safeParse` 断言）；目标 schema/card/dialog/UI/transport contract ESLint exit 0；完整 TypeScript 仍仅命中既有 exports/starter 与 admin dashboard baseline 错误，未命中本批文件；目标文件 no-index whitespace check 无输出（新增文件差异预期 exit 1）。未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy；DOM/浏览器 lifecycle 仍由前一轮 source contract 覆盖。
- WP-04B2 implementation/verification（2026-08-26）：dialog 已接入当前 Preview 门禁下的 Save estimate 与 Confirm（分别复用 `supplierBatchChargeEstimateSchema.safeParse` / `supplierBatchChargeConfirmSchema.safeParse`，Confirm 仅携带 preview revision），严格核对服务端 batch/status/charge/idempotency/编辑 chargeId 后才进入 `onCostChanged` 回读；保存与确认均不自动触发另一动作，回读失败保持 `persistedAwaitingRefresh` 终态且仅可重试回读；现有 panel `refreshSupplierBatchCost` 的 `Promise.all([fetchAdminSupplierBatchDetail(batchCode), refreshSupplierBatches(undefined, {clearNotice:false})])` 接线保持不变，并让成本回读路径的列表异常重新抛出以触发终态。UI/运输 core/routes/价格合同 `node --test` 42/42 通过（UI 16/16）；目标 dialog/card/panel/UI/transport contract ESLint exit 0；完整 TypeScript 观察仍仅命中既有 exports/starter 与 admin dashboard baseline 错误，未命中本批文件；目标 untracked 文件 no-index whitespace check 无输出（差异预期 exit 1）。无 DOM integration 依赖，mutation/refresh 生命周期以可执行 helper 与精确 source contract 覆盖；未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy。
- WP-04B2 独立审查修复（2026-08-26）：收紧 `postMutation` 的 unknown-write 分类（HTTP 5xx、无可信 4xx code、`ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE`、2xx 畸形/归属无效响应均保留同一动作、幂等键、chargeId 与 preview fingerprint）；新增首选回读核对与同 key 回读/重试分支，回读按 batch、key、fingerprint、动作状态及 edit chargeId 严格匹配，estimate 允许同 fingerprint 已 confirmed，confirm 只接受 confirmed；fingerprint 冲突清 preview 并报安全 `IDEMPOTENCY_CONFLICT`，写成功后的回读失败保持仅回读终态，所有 stale/immutable/cancelled/not-found/batch-not-found 错误使旧 Preview 失效；mutation/readback/refresh 均有 active guard、独立 AbortController 与 25 秒超时。panel 的 detail fetch 与 `refreshSupplierBatchCost` 现接收并贯穿同一 signal，Promise.all 后返回规范化 `AdminSupplierBatchDetail`，仍只以服务端 detail/list 更新正式状态。
- WP-04B2 独立审查验证（2026-08-26）：`node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-price-contract.test.mjs` 43/43 通过（UI 17/17；新增 unknown-write 分类、回读匹配/冲突/状态、可信 4xx、无 POST 回读/刷新和 panel signal/return 源契约）；目标 dialog/panel/UI 合同 ESLint exit 0；完整 `npm exec -- tsc --noEmit --pretty false --incremental false` 仍只命中既有 exports/starter 与 `admin-dashboard.tsx` baseline 错误，未命中本批文件；tracked panel 与新增 dialog/UI 合同测试 diff check 无 whitespace 输出。无 DOM integration 依赖，关闭/卸载/Abort 生命周期以源码契约覆盖；未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy，当前不宣称生产或浏览器验收通过。
- WP-04B2 known-success/fingerprint/auth 修复验证（2026-08-26）：已将写入成功后的状态改为携带 `action`、`idempotencyKey`、`chargeId`、`payloadFingerprint` 与 `snapshotKey` 的 `SupplierBatchMutationContext`；严格结果 fingerprint 不匹配继续 fail-closed 为 unknown，可信 401/403 `ADMIN_FORBIDDEN` 才作为确定拒绝并使用中/意安全文案。已知成功的写后回读（not_found、状态不符、idempotency conflict、invalid、异常、超时）均保持该上下文，只允许 `performMutationReadback` 严格匹配后关闭；`retryRefresh` 只回读不 POST，unknown 分支仍保留核对与同 key 重试。UI/运输 core/routes/价格合同 `node --test` 43/43 通过（UI 17/17，含 root/charge fingerprint 正反例及 403 有/无 code 分类）；目标 dialog/UI 合同 ESLint exit 0；完整 TypeScript 观察仍仅命中既有 exports/starter 与 `admin-dashboard.tsx` baseline 错误，未命中本批文件；无 DOM integration，生命周期以 source contract 覆盖；未运行 build、浏览器、Supabase、migration、linked/remote 或 deploy。
- WP-04B2 final local validation（2026-08-26，当时观察，已被最终验证取代）：最终完整合同集合 `node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-price-contract.test.mjs` 43/43 通过（transport 26、UI 17，price 合同包含在 transport 集合内）；全量 `npm run lint` 通过。`npm run build` 当时编译阶段通过，TypeScript 阶段因既有 `exports/partspro-framework-kit-2026-08-24/starter` 缺少 `@/lib/api/errors` 等模块而失败，未命中运输成本文件；`npx tsc --noEmit` 同样仅命中该 starter 与 `src/components/partspro/admin-dashboard.tsx` baseline。该 baseline 已于 2026-08-26 由 TASK-20260826-01 解除并独立复审无 P1/P2。tracked/untracked 目标 diff check 通过。对 `supabase/migrations/20260825202035_supplier_batch_transport_costs.sql` 仅做静态扫描：无 `DROP`/`TRUNCATE`/`DELETE FROM`，存在受条件约束的 finance cost-layer 一次性 `UPDATE`；新 charges/allocations 表、FK/非负/状态/金额约束、RLS 与表权限、4 个 public cost RPC 的 `SECURITY DEFINER` + `search_path = ''` 及 revoke/grant 签名均与任务卡契约一致；未运行本地/linked SQL、migration、浏览器、远端或 deploy。WP-04 本地代码实现与验证完成，后续最终生产应用、浏览器验收和发布已在文首记录。
- WP-06 linked 只读核对（2026-08-26，历史记录，已于 2026-08-27 被新证据取代）：本地 preflight PASS（`supabase/.temp/project-ref` 为 `yiuxrjqexlfjtxxrkqvi`，目标 migration 存在）；`supabase --version` PASS（2.101.0）；`supabase migration list --help` 与 `supabase db push --help` PASS，均确认所需 `--linked`/`--dry-run` 参数。允许的远端只读命令 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` 已按要求重试一次，第一次和第二次均 exit 1，错误为 `Access token not provided`；当时因认证失败停止，未运行 dry-run。该条只保留历史证据，不再作为当前 blocker；当时远端未写、未 apply、未 repair、未 pull、未 reset。
- WP-06 connector fallback comparison（2026-08-26，历史记录，已于 2026-08-27 被新证据取代）：仅调用已连接的 `list_migrations` 读取 `yiuxrjqexlfjtxxrkqvi` 远端历史；完整集合比较结果为 remote 103 条、local 104 条，remote-only 为空，local-only 仅 `20260825202035_supplier_batch_transport_costs`，版本相同但名称不同为空，名称相同但版本不同为空。此结果不等同 dry-run；CLI `migration list --linked` 当时两次 exit 1（`Access token not provided`），`db push --linked --dry-run` 当时未执行；该条只保留历史证据，不再作为当前 blocker，远端未写，apply 关闭。
- WP-06 CLI linked/dry-run（2026-08-27，重排前历史证据）：CLI 2.101.0 登录成功；project-ref 精确为 `yiuxrjqexlfjtxxrkqvi`；`SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` exit 0，remote-only 无、local-only 仅 `20260825202035_supplier_batch_transport_costs`；`SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run` exit 0，Would push 仅当时的 transport 草案，明确未 push；本轮未执行 apply 或其他远端写入。权限 migration 重排后须按 `20260825202034` → `20260825202035` 重新进行只读核对。
- WP-06 independent review（2026-08-27）：dry-run gate `GO`、apply gate `NO-GO`（均针对权限 migration 重排前的 transport 草案）；P0/P1 无。记录五项 P2：既有 `finance_cost_layers` 回填/约束兼容性、手工 schema 漂移、migration 重排后需重新核对 linked history/dry-run、历史成本归入 goods 语义需财务核对、dry-run 不证明真实 RLS/RPC/约束执行；同名 trigger 的本地 `tgrelid` guard 已在本批修复，真实数据库仍需对象/执行级核对。
- WP-07 schema/RLS 只读预检（2026-08-27）：目标对象无漂移；finance cost-layer 回填候选 382/382 均通过候选检查；模拟回填后约束违规数为 0。预检同时确认 `public.supplier_batches` 与 `public.finance_cost_layers` 的直接表级 `TRUNCATE` 权限 P1，已转入 [P1-2026-08-27-table-truncate-grants](../done/P1-2026-08-27-table-truncate-grants.md)；该 P1 已完成最小权限修复，应用后 ACL 双证据通过。
- WP-03 permission-fix local draft（2026-08-27，apply 前历史）：按 Supabase CLI 生成 `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；仅撤销 `supplier_batches` 的 anon/authenticated TRUNCATE 与 `finance_cost_layers` 的 authenticated TRUNCATE，明确保留 service_role/postgres 及所有其他权限；当时未执行 linked/remote 命令、revoke、apply、push 或 deploy。
- 2026-08-27 migration ordering review（apply 前历史）：原权限 migration `20260827071053_revoke_supplier_batch_truncate_privileges.sql` → `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；原因是 P1 权限修复必须先于 transport migration `20260825202035_supplier_batch_transport_costs.sql`。两份目标 migration 的本地顺序现为 `20260825202034` 权限 → `20260825202035` 运输；当时未执行 linked/remote、revoke、apply、push 或 deploy。
- 2026-08-27 review fixes（apply 前历史）：三个 transport trigger existence check 均补充目标 relation 的 `tgrelid` regclass；transport contract test 新增 migration 文件名/顺序与 relation-qualified trigger 回归断言；writer matrix 未发现绕过兼容边界的 landed-cost writer，真实数据库执行当时仍待后续验证。
- 2026-08-27 local transport review（apply 前历史）：既有 DB/API/UI 静态契约由 33/33 运输合同测试与目标 ESLint 通过；未发现需要在本次权限修复批次内修改的确定性应用缺口。trigger relation guard 已在本批修复，真实数据库对象/执行级核对等 P2 当时仍保留，未扩大本批文件范围。
- 2026-08-27 lineage reconciliation：connector fresh remote ledger 为 103 条；clean candidate（源自 origin/main）原缺 3 条已应用历史 `20260722212145_admin_website_analytics_permission`、`20260808111643_approve_shared_screen_model_navigation`、`20260808115853_add_oneplus_oppo_shared_screen_navigation`。三份均已按远端 `statements` 与 primary 同名 SQL 逐条核对为 semantic exact（首份仅尾随换行不同，后两份 byte exact），并按原内容补入 clean candidate，仅作为已应用历史账本，不属于本次待执行 migration；补入后理论 ledger 为 remote 103 + pending 2 = 105，remote-only=0，local-only 仅按 `20260825202034` → `20260825202035` 顺序保留两份目标 migration。正式 CLI history/dry-run 尚未通过：CLI list 因认证缺失 exit 1，dry-run 未执行；不得宣称 CLI 或 dry-run 已通过。
- 2026-08-27 fresh connector preflight：仅执行生产只读 SELECT/catalog 与 security/performance advisors。ACL 双证据确认 `supplier_batches` 的 `has_table_privilege(TRUNCATE)` 对 anon/authenticated/service_role/postgres 均为 true，`aclexplode` 直接条目同为 4 个角色；`finance_cost_layers` 的 has_table_privilege 对 anon 为 false、authenticated/service_role/postgres 为 true，`aclexplode` 直接条目为 authenticated/service_role/postgres，grantor 均为 postgres、不可转授权。两表 RLS 均 enabled、未 forced，现有 7 条 policy 均属 authenticated，RLS 不保护 TRUNCATE。目标两张 charges/allocations 表、9 个 index、2 个 policy、3 个 trigger、12 个 helper/RPC、30 个目标 constraint 均不存在，未发现半成品或同名碰撞；finance 新三列尚不存在。回填候选总数及 supplier-batch 候选均为 382/382，模拟 breakdown/total-match 约束违规均为 0；supplier_batches 为 20 行/155648 bytes，finance_cost_layers 为 382 行/499712 bytes，relation locks granted/waiting 均为 0，超过 5 分钟事务为 0。security advisors 40 条无本功能直接新命中；performance advisors 95 条仅见既有 finance FK/supplier-batch index INFO，不归因本 migration。CLI auth 未恢复，正式 migration list/dry-run 未完成；本次只读 preflight 不改变生产，apply gate 保持 NO-GO。
- released（最终）：已完成；Git/Vercel 发布与生产 smoke 已通过独立发布门
- closed（最终）：已关闭；任务状态为 `completed`，已移入 `done`

## 结果

最终结果见文首“当前执行状态”与 Owner Gate：三份 production migration、ACL/schema/RLS/RPC/backfill post-check、三段 release chain、最终 deployment、local validation 与 production smoke 均已完成；任务状态为 `completed`，任务卡已移入 `done`。真实数据上的 Save/Confirm 未执行，未伪造生产写入。

## 历史 CLI linked dry-run 证据（apply 前，2026-08-27，已被最终结果取代）

- 持久 Supabase CLI 登录已成功；凭据仅保存在 CLI 用户级存储，未写入仓库、`.env` 或任务卡，也未回显或复制任何 secret。关闭初始 shell 后，在未设置 `SUPABASE_ACCESS_TOKEN` 的新 shell 中完成非敏感认证状态确认。
- linked target 精确为 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。
- `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` exit 0；remote-only=0；local-only 仅两份，顺序为 `20260825202034_revoke_supplier_batch_truncate_privileges` → `20260825202035_supplier_batch_transport_costs`。
- `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run` exit 0；dry-run 仅列出上述两份 migration，顺序相同；未执行非 dry-run、apply、repair、push 或 deploy。
- 当时 migration 技术门为 `GO`；apply 门状态为“技术门GO，等待Owner独立批准”。该历史证据不表示生产已修复；当时两份 migration 尚未应用，后续已完成最终生产 apply、核对与发布门验收。
- 本次仅补充任务卡证据；源码、依赖、配置、目标 SQL 和测试未变化，既有定向测试、lint/build 证据可复用，未因文档变更重复运行。
- 状态说明：本节及前文认证恢复前关于 CLI 未认证、dry-run pending 或 apply `NO-GO` 的记录均为历史快照；最终以文首完成证据为准，三份 migration 已应用并完成生产核对，不能将本节 apply 前快照当作当前状态。

## 历史生产 apply 与 post-check 证据（2026-08-27，已被最终结果取代）

- linked target 已再次确认精确为 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。apply 前最后一次 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` exit 0，remote-only=0，local-only 仅 `20260825202034_revoke_supplier_batch_truncate_privileges` → `20260825202035_supplier_batch_transport_costs`。
- 按 Owner 批准执行唯一写命令 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked`，exit 0；`20260825202034_revoke_supplier_batch_truncate_privileges.sql` 与 `20260825202035_supplier_batch_transport_costs.sql` 均生产 apply exit 0。未使用 `--include-all`、`--include-seed`、`repair`、`reset` 或其他绕过参数。
- apply 后再次运行 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` exit 0，local/remote 完全对齐，remote-only=0、local-only=0。
- ACL P1 已消除：`has_table_privilege` 与 `aclexplode` 双证据确认两表 anon/authenticated 的目标 `TRUNCATE=false`；`service_role` 与 owner `postgres` 保留已批准的 `TRUNCATE=true`，其他必要表级权限未被意外扩大或收回。
- schema/RLS/RPC/回填独立复核结论为 `GO`：新 charges/allocations 表、RLS/policies、indexes、constraints、triggers、RPC/helper 的对象、安全属性和 execute grants 均符合契约；382/382 finance cost-layer backfill 候选及约束核对无违规，charges/allocations 初始计数为 0。
- post-check 同时确认权限种子、locks/长事务和本次 migration 相关 Postgres logs；无本次 apply 错误。security advisor 新增项仅为预期 public cost `SECURITY DEFINER` RPC 的 P2 提示，已核对 permission guard 与空 `search_path`；performance advisor 新增项为新空表的预期索引提示。
- 本地 React lazy-load 提交为 `006159fbcaa0ead39681031b8b805dd545de9776`（短 hash `006159f`）；运输相关合同测试 `34/34`、全量 `npm run lint` 与 `npm run build` 均通过。
- 该段为两份目标 migration 的历史 apply/post-check 摘要；最终三份 migration、Git/Vercel 发布、浏览器/API smoke 与 P3 残余观察均以文首“当前执行状态”和“最终结果”为准。
