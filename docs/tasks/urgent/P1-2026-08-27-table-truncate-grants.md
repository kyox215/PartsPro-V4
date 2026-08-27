# P1-2026-08-27-table-truncate-grants

状态：in_progress

看板目录：urgent

优先级：P1

Task ID：TASK-20260827-01

风险等级：R3

自治等级：L2

## 老板原始目标

登记并处置生产权限 P1：确认 `public.supplier_batches` 与 `public.finance_cost_layers` 的表级 `TRUNCATE` 权限，先以最小权限原则判断并移除 anon/authenticated 不必要的 `TRUNCATE`；`service_role` 与 owner 是否保留必须由业务负责人和平台负责人明确决策，不能预设全部 revoke。任何权限 migration 和 apply 仍需老板另批。

## 目标

在不破坏现有业务读写和服务角色运维能力的前提下，完成两张生产表的表级 `TRUNCATE` 权限决策、受批准的最小化修复设计和可验证的迁移闭环，优先阻断 anon/authenticated 的不必要清空能力。

## 业务影响

两张现存生产表具有直接表级 `TRUNCATE` grant；`TRUNCATE` 不受行级 RLS 防护，可能绕过行级业务边界造成批次、成本层或相关数据的整体清空风险。当前尚未发生 revoke、migration apply 或远端写入，风险处于已确认但未整改状态。

## 完成定义

- 业务与平台负责人书面确认 anon/authenticated、service_role、owner 的最终权限矩阵和保留理由。
- 权限修复 migration 由 `supabase migration new <name>` 创建，SQL 经过 ACL/RLS/对象范围和 PartsPro 业务契约审查。
- linked migration history 无 divergence，`supabase db push --linked --dry-run` 只列出本任务 migration；dry-run 不等同 apply。
- 在老板另行批准后完成 apply，并以 `has_table_privilege`、`relacl`、角色 membership/RLS 只读核对确认 anon/authenticated 的 `TRUNCATE=false`，同时确认必要 SELECT/INSERT/UPDATE/DELETE 与 service_role/owner 的已批准结论未被意外破坏。
- 任务卡、运输成本任务卡、migration、审查和应用后证据相互一致；在上述条件满足前保持 `in_progress`，不宣称生产修复完成。

## 主责部门

Supabase RLS/权限代理

## 协作部门

Supabase Migration 守门代理、PartsPro 业务契约代理、平台发布部、文档审计部

## 工程守门代理

Supabase Migration 守门代理、PartsPro 业务契约代理

## RACI

| Role | Owner |
|---|---|
| Responsible | Supabase RLS/权限代理 |
| Approver | 老板；平台负责人和业务负责人共同确认 service_role/owner 处置 |
| Consulted | Supabase Migration 守门代理、PartsPro 业务契约代理 |
| Informed | 平台发布部、文档审计部、采购到货部、财务 |

## 涉及范围

- 页面：无页面改动；后台与供应商到货 UI 只作为权限影响面核对，不在本任务直接修改。
- API：无 API 代码改动；需核对 Supabase Data API/后台 RPC 是否依赖当前表级读写权限。
- 数据表/RPC：`public.supplier_batches`、`public.finance_cost_layers`；角色 `anon`、`authenticated`、`service_role`、owner `postgres`；关联 RLS、ACL、membership 和未来权限 migration。
- 文档：本任务卡、`P1-2026-08-25-supplier-arrival-transport-cost.md` 及后续 migration/runbook/审查记录。
- 外部系统：linked Supabase 项目 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`；当前只读证据，不授权远端写入。

## 已知事实

- `public.supplier_batches` 是现存对象，owner 为 `postgres`，`relacl` 非 NULL；直接 `TRUNCATE` grant 给 `anon`、`authenticated`、`service_role`。
- `public.supplier_batches` 的权限矩阵中，`anon`、`authenticated`、`service_role`、`postgres` 的 SELECT/INSERT/UPDATE/DELETE/TRUNCATE 均为 true。
- `public.finance_cost_layers` 是现存对象，owner 为 `postgres`，`relacl` 非 NULL；直接 `TRUNCATE` grant 给 `authenticated`、`service_role`，没有给 `anon`。
- `public.finance_cost_layers` 的权限矩阵中，`authenticated` 的 SELECT/INSERT/UPDATE/TRUNCATE 为 true、DELETE 为 false；`service_role` 和 `postgres` 五项均为 true；`anon` 五项均为 false。
- 两表均 `RLS enabled=true`、`force row security=false`；owner `postgres` 的 `rolbypassrls=true`，因此 RLS 不能抵消 owner 的表级能力，也不能保护 `TRUNCATE`。
- 两表 `relacl` 均为非 NULL；已展开的直接 ACL grantor 为 `postgres`，相关 `is_grantable=false`，不是“默认 owner ACL”或不存在对象的误判。
- 只读 catalog/privilege 查询观察到 `authenticator` 与 `anon`、`authenticated`、`service_role` 的 membership 行，以及 `postgres` 与多个相关角色的 membership 行；membership 关系需结合实际运行路径继续核对，不能替代直接 ACL 结论。
- 上述结论来自 linked 项目的只读 `execute_sql` catalog/privilege SELECT；截至本任务建立时尚未执行 revoke、权限 migration、DDL、DML 或 migration apply。

## 假设与未知项

- anon/authenticated 的直接 `TRUNCATE` 不是当前业务所必需，但仍需业务契约和平台负责人确认后才能修复。
- `service_role` 与 owner 的直接 `TRUNCATE` 是否用于备份、维护、测试或受控运维尚未确认；本任务不预设全部 revoke。
- 现有应用、后台 job、RPC 或外部运维脚本是否依赖直接表级 DELETE/TRUNCATE 尚未完成只读调用链核对。
- 真实 schema 可能存在手工漂移或同名对象；权限 migration 需限定目标 relation 和目标 ACL，不能依赖宽泛对象名称。
- RLS policy、RPC `SECURITY DEFINER`、Data API grants 与表级 ACL 的组合效果仍需在批准前完成只读预检。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | Supabase RLS/权限代理 | 只读 ACL/RLS/role evidence closure | linked 项目与权限查询 | 两表对象存在性、直接 ACL、权限矩阵、owner 和 membership 可追溯；当前已确认 P1 |
| WP-02 | PartsPro 业务契约代理、平台负责人 | 最小权限决策与兼容性清单 | WP-01；业务/运维使用场景 | 明确 anon/authenticated 必须移除的权限，以及 service_role/owner 保留或移除理由 |
| WP-03 | Supabase Migration 守门代理 | 权限 migration 草案与静态审查 | WP-02；老板批准 migration 设计 | 使用 `supabase migration new`，限定目标 relation，完成 SQL/ACL/RLS/安全审查；未获批不得 apply |
| WP-04 | Supabase Migration 守门代理、平台发布部 | linked history 与 dry-run 证据 | WP-03；老板批准只读 dry-run | history 无 divergence，dry-run 只列出本任务 migration；不执行 apply |
| WP-05 | Supabase RLS/权限代理、PartsPro 业务契约代理 | 应用后权限回归与审计证据 | WP-04；老板另行批准 apply | `has_table_privilege`/`aclexplode`/RLS/membership 核对通过，必要业务读写未回归，审计记录完整 |

## 批准要求

- 是否需要老板批准：需要；当前只读确认已完成，任何 revoke、权限 migration、远端写入和 apply 必须另行明确批准。
- 是否需要 Supabase migration 安全门：需要；必须使用 CLI 创建 migration，完成 linked history、风险扫描、dry-run 和应用后权限验证。
- 是否需要 Vercel 发布门：当前不需要；本任务不改应用、不部署 Vercel。
- 是否需要 PartsPro 业务契约验收：需要；要确认供应商到货、成本层、后台运维和服务角色没有被误伤。

## 验收标准

- 两张现存表的直接 `TRUNCATE` grant、owner、relacl 来源、grantor/grantee/privilege_type/is_grantable、RLS flags 和角色 membership 均有可追溯证据。
- 权限决策明确区分 anon/authenticated、service_role、owner；优先移除 anon/authenticated 不必要的 `TRUNCATE`，不未经决策扩大 revoke 范围。
- 权限 migration 若获批，必须由 `supabase migration new` 生成，不能通过临时 SQL、`apply_migration` 或手工历史修复改变远端。
- migration history 无 remote-only divergence，dry-run 只列出本任务 migration；不使用 `--include-all`、`--include-seed`、`migration repair`、`db pull` 或 `db reset`。
- 应用后 `anon`/`authenticated` 在两张表上的 `TRUNCATE` 按批准矩阵为 false，必要的 SELECT/INSERT/UPDATE/DELETE 和受批准的 service_role/owner 权限保持一致。
- RLS 仍按原策略工作，但验收不把 RLS 当作 `TRUNCATE` 防护；权限审查、业务契约验收和审计证据均完成。
- 当前未批准或未执行的 apply、revoke、DDL、DML、部署不被描述为已完成。

## 禁止事项

- 当前不得执行 `REVOKE`、`GRANT`、权限 migration apply、DDL、DML、`apply_migration` 或任何生产写库。
- 不得预设 service_role 或 owner 全部 revoke；不得为“修复 P1”扩大到无证据的角色、schema、表或函数。
- 不得把 RLS、HTTP 401、dry-run 或本地 ACL 静态结果当作已完成生产修复。
- 不得修改运输成本 migration、应用代码、权限 TypeScript、Vercel 配置或无关任务文件。
- 不得回显、记录或复制任何 access token、secret、密码或业务数据行。

## 验证命令

当前与后续命令仅作为批准后的验证计划；本任务已执行 catalog/privilege 只读核对，并追加生成本地权限 migration 草案与静态检查；未执行 linked/remote 写入：

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration new revoke_supplier_batch_truncate_privileges
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
git diff --check
```

权限验证使用 `has_table_privilege`、`pg_class.relacl`/`aclexplode`、`pg_class.relrowsecurity`/`relforcerowsecurity`、owner role flags 和 `pg_auth_members` 的 catalog/privilege SELECT；不得返回业务行或 secret。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| linked catalog/privilege `execute_sql` SELECT | passed | 两表均为现存对象；直接 ACL、owner、RLS flags、role matrix 和 membership 已返回并核对；无业务行、无 secret |
| `public.supplier_batches` direct TRUNCATE review | P1 confirmed | `anon`、`authenticated`、`service_role` 有直接 TRUNCATE；四角色五项权限矩阵均为 true |
| `public.finance_cost_layers` direct TRUNCATE review | P1 confirmed | `authenticated`、`service_role` 有直接 TRUNCATE；`authenticated` 的 DELETE=false，其余 SELECT/INSERT/UPDATE/TRUNCATE=true；anon 五项=false |
| ACL/RLS/object existence review | passed | relacl 非 NULL、grantor 为 postgres、is_grantable=false、owner 为 postgres、两表 RLS enabled 且未 forced；RLS 不保护 TRUNCATE |
| `supabase migration new revoke_supplier_batch_truncate_privileges` | passed locally | CLI 生成 `supabase/migrations/20260825202034_revoke_supplier_batch_truncate_privileges.sql`；未连接 linked、未执行 revoke 或 apply |
| local permission migration SQL static review | passed locally | 可执行 SQL 仅含两条精确 `REVOKE TRUNCATE`，目标为 supplier_batches 的 anon/authenticated 与 finance_cost_layers 的 authenticated；未触碰 service_role/postgres 或其他权限 |
| remote revoke/permission migration apply | not run by design | 当前仅生成本地草案；未执行远端 revoke、DDL、DML 或 apply，仍需老板另批 |
| linked dry-run | pending | 仅在权限决策、migration 草案和安全门满足后执行；当前不运行 |

## 回滚方案

- 在权限 migration 未 apply 前无远端回滚动作；当前保持现状并阻断未经批准的写入。
- 若后续批准 migration 后发现必要业务读写回归，先暂停受影响入口，保留审计证据，由 Supabase Migration 守门代理生成经审查的反向权限 migration；不得临时手工 `GRANT` 恢复。
- 反向 migration 只能恢复经过负责人确认的最小权限，不得默认恢复 anon/authenticated 的 `TRUNCATE`。
- 若发现已发生数据清空或成本层损坏，转入独立数据恢复/财务审计流程，不在本任务直接回填或覆盖事实。

## 残余风险

- service_role 与 owner 的 TRUNCATE 处置尚未决策；owner 具 bypassrls，RLS 不能作为其替代防线。
- anon/authenticated 的现有直接 TRUNCATE grant 在修复 apply 前仍然存在；P1 仍开放但已登记。
- 手工 schema/ACL 漂移、同名 trigger/object 检查范围和 role membership 运行路径仍需只读预检。
- 权限 migration 的真实 SQL 执行、RLS/RPC/约束兼容性和应用后回归尚未验证。
- 供应商到货运输成本 migration 的 finance cost layer、历史 goods 语义和财务口径仍由原任务卡管理，不因本任务登记而自动批准。

## 执行记录

- 创建：2026-08-27，由 luna_worker 根据主代理派单创建；目标文件创建前确认不存在。
- 批准：老板已批准本次生产权限 P1 的只读复核和文档登记；revoke、权限 migration、远端写入和 apply 未获批准。
- 开始：2026-08-27，完成 linked catalog/privilege 只读核对。
- review：2026-08-27，确认两张现存表存在直接 TRUNCATE grant，RLS 不能防护；P1 确认。
- WP-03 local draft（2026-08-27）：按 CLI 创建 `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；SQL 仅撤销 `public.supplier_batches` 对 anon/authenticated 的 TRUNCATE 与 `public.finance_cost_layers` 对 authenticated 的 TRUNCATE，未预设撤销 service_role/postgres，未改变其他权限。
- 2026-08-27 migration ordering review：原权限 migration `20260827071053_revoke_supplier_batch_truncate_privileges.sql` → `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；原因是 P1 权限修复必须先于运输成本 migration `20260825202035_supplier_batch_transport_costs.sql`。候选顺序固定为 `20260825202034` 权限 → `20260825202035` 运输；重排后 linked history/dry-run 需重新只读核对，未执行 revoke、apply 或其他远端写入。
- 2026-08-27 lineage reconciliation：connector fresh remote ledger 为 103 条；clean candidate（源自 origin/main）原缺 3 条已应用历史 migration。已按远端 `statements` 与 primary 同名 SQL 逐条核对为 semantic exact（首份仅尾随换行不同，后两份 byte exact），并按原内容补入 clean candidate，作为已应用历史账本而非待执行 migration；补入后理论 ledger 为 remote 103 + pending 2 = 105，remote-only=0，local-only 仅按 `20260825202034` → `20260825202035` 顺序保留两份目标 migration。正式 CLI history/dry-run 尚未通过：CLI list 因认证缺失 exit 1，dry-run 未执行；不得宣称 CLI 或 dry-run 已通过。
- 2026-08-27 fresh connector preflight：仅执行生产只读 SELECT/catalog 与 security/performance advisors。ACL 双证据确认 `supplier_batches` 的 `has_table_privilege(TRUNCATE)` 对 anon/authenticated/service_role/postgres 均为 true，`aclexplode` 直接条目同为 4 个角色；`finance_cost_layers` 的 has_table_privilege 对 anon 为 false、authenticated/service_role/postgres 为 true，`aclexplode` 直接条目为 authenticated/service_role/postgres，grantor 均为 postgres、不可转授权。两表 RLS 均 enabled、未 forced，现有 7 条 policy 均属 authenticated，RLS 不保护 TRUNCATE。目标两张 charges/allocations 表、9 个 index、2 个 policy、3 个 trigger、12 个 helper/RPC、30 个目标 constraint 均不存在，未发现半成品或同名碰撞；finance 新三列尚不存在。回填候选总数及 supplier-batch 候选均为 382/382，模拟 breakdown/total-match 约束违规均为 0；supplier_batches 为 20 行/155648 bytes，finance_cost_layers 为 382 行/499712 bytes，relation locks granted/waiting 均为 0，超过 5 分钟事务为 0。security advisors 40 条无本功能直接新命中；performance advisors 95 条仅见既有 finance FK/supplier-batch index INFO，不归因本 migration。CLI auth 未恢复，正式 migration list/dry-run 未完成；本次只读 preflight 不改变生产，apply gate 保持 NO-GO。
- verified：只读证据与本地 migration 静态审查已完成；远端 revoke、migration apply、linked dry-run 和应用后回归仍待后续批准门。
- released：不适用；本任务不发布
- closed：未完成

## 结果

本轮 lineage reconciliation（2026-08-27）已确认 clean candidate（源自 origin/main）此前缺少 3 条 remote-only 历史；三份 SQL 已以远端 `statements` 逐条核对并按原内容补入候选，primary 与候选内容保持一致。它们仅用于补齐已应用历史账本，不是本次待执行 migration。候选理论 ledger 为 remote 103 + pending 2 = 105，remote-only=0，local-only 仅为按序的 `20260825202034_revoke_supplier_batch_truncate_privileges`、`20260825202035_supplier_batch_transport_costs`。正式 CLI `migration list --linked` 因认证缺失 exit 1，`db push --linked --dry-run` 未执行，不能宣称 CLI/dry-run 通过；apply、repair、push、deploy 均未进行。
本次仅补入已核验的 3 份历史 SQL 并更新任务卡；应用源码、两份目标 SQL、测试、依赖与配置均未变化，既有 lint/build/tests 验证证据可复用，未重跑。
本轮 fresh connector preflight（2026-08-27）仅作生产只读证据：ACL 双证据、RLS/policy、目标对象与冲突、finance 结构、回填模拟、表规模/锁/长事务和 advisors 均已核对如上；未执行任何 DDL/DML、revoke、migration、repair 或部署。connector 证据不能替代 CLI auth、migration list --linked 或 db push --linked --dry-run，任务保持 in_progress，apply 仍为 NO-GO。

已确认生产项目中存在表级权限 P1：`public.supplier_batches` 对 anon/authenticated/service_role 直接授予 TRUNCATE，`public.finance_cost_layers` 对 authenticated/service_role 直接授予 TRUNCATE；两表均为现存对象，relacl 非 NULL，RLS 不保护 TRUNCATE。2026-08-27 已按 CLI 生成本地权限修复草案 `20260825202034_revoke_supplier_batch_truncate_privileges.sql`，只包含目标 anon/authenticated revoke；尚未执行任何远端 revoke、权限 migration apply、远端写入或部署，任务保持 `in_progress` 并位于 `urgent`。该 P1 migration 必须排在 `20260825202035_supplier_batch_transport_costs.sql` 之前；重排后仍需业务/平台负责人确认最小权限处置，再按 Supabase migration 安全门重新进行只读 history/dry-run 与另行批准的 apply。
