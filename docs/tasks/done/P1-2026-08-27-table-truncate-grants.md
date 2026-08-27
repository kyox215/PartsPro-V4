# P1-2026-08-27-table-truncate-grants

状态：done

看板目录：done

优先级：P1

Task ID：TASK-20260827-01

风险等级：R3

自治等级：L2

## 老板原始目标

登记并处置生产权限 P1：确认 `public.supplier_batches` 与 `public.finance_cost_layers` 的表级 `TRUNCATE` 权限，按最小权限原则移除 anon/authenticated 不必要的 `TRUNCATE`；`service_role` 与 owner `postgres` 按批准矩阵保留。两份 migration 已完成生产 apply 与应用后核验。

## 目标

在不破坏现有业务读写和服务角色运维能力的前提下，完成两张生产表的表级 `TRUNCATE` 权限决策、受批准的最小化修复设计和可验证的迁移闭环，优先阻断 anon/authenticated 的不必要清空能力。

## 业务影响

两张现存生产表曾具有直接表级 `TRUNCATE` grant；`TRUNCATE` 不受行级 RLS 防护，可能绕过行级业务边界造成批次、成本层或相关数据的整体清空风险。最小权限修复已完成，应用后 ACL 双证据通过，P1 风险已关闭。

## 完成定义

- 业务与平台负责人确认 anon/authenticated、service_role、owner 的最终权限矩阵和保留理由。
- 权限修复 migration 由 `supabase migration new <name>` 创建，SQL 经过 ACL/RLS/对象范围和 PartsPro 业务契约审查。
- linked migration history 无 divergence，`supabase db push --linked --dry-run` 只列出本任务 migration；dry-run 不等同 apply。
- 在老板明确批准后完成 apply，并以 `has_table_privilege`、`aclexplode`、`relacl`、角色 membership/RLS 只读核对确认 anon/authenticated 的 `TRUNCATE=false`，同时确认必要 SELECT/INSERT/UPDATE/DELETE 与 service_role/owner 的已批准结论未被意外破坏。
- 任务卡、运输成本任务卡、migration、审查和应用后证据相互一致；上述条件均已满足，任务关闭。

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
- 文档：本任务卡、[P1-2026-08-25-supplier-arrival-transport-cost](../now/P1-2026-08-25-supplier-arrival-transport-cost.md) 及后续 migration/runbook/审查记录。
- 外部系统：linked Supabase 项目 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`；两份目标 migration 已按批准完成生产 apply，未扩大到其他远端写入。

## 已知事实

- `public.supplier_batches` 是现存对象，owner 为 `postgres`，`relacl` 非 NULL；直接 `TRUNCATE` grant 给 `anon`、`authenticated`、`service_role`。
- `public.supplier_batches` 的权限矩阵中，`anon`、`authenticated`、`service_role`、`postgres` 的 SELECT/INSERT/UPDATE/DELETE/TRUNCATE 均为 true。
- `public.finance_cost_layers` 是现存对象，owner 为 `postgres`，`relacl` 非 NULL；直接 `TRUNCATE` grant 给 `authenticated`、`service_role`，没有给 `anon`。
- `public.finance_cost_layers` 的权限矩阵中，`authenticated` 的 SELECT/INSERT/UPDATE/TRUNCATE 为 true、DELETE 为 false；`service_role` 和 `postgres` 五项均为 true；`anon` 五项均为 false。
- 两表均 `RLS enabled=true`、`force row security=false`；owner `postgres` 的 `rolbypassrls=true`，因此 RLS 不能抵消 owner 的表级能力，也不能保护 `TRUNCATE`。
- 两表 `relacl` 均为非 NULL；已展开的直接 ACL grantor 为 `postgres`，相关 `is_grantable=false`，不是“默认 owner ACL”或不存在对象的误判。
- 只读 catalog/privilege 查询观察到 `authenticator` 与 `anon`、`authenticated`、`service_role` 的 membership 行，以及 `postgres` 与多个相关角色的 membership 行；membership 关系需结合实际运行路径继续核对，不能替代直接 ACL 结论。
- 上述初始结论来自 linked 项目的只读 `execute_sql` catalog/privilege SELECT；apply 后以 `has_table_privilege` 与 `aclexplode` 双证据完成复核。

## 假设与未知项

- anon/authenticated 的直接 `TRUNCATE` 不是当前业务所必需，已按批准矩阵撤销。
- `service_role` 与 owner 的直接 `TRUNCATE` 按受控运维需要保留，未扩大 revoke 范围。
- 现有应用、后台 job、RPC 或外部运维脚本是否依赖直接表级 DELETE/TRUNCATE 不在本次权限 revoke 范围内，后续变更仍需按调用链复核。
- 权限 migration 已限定目标 relation 和目标 ACL；apply 后对象、schema/RLS/RPC 和权限核对通过，后续 schema 漂移仍需回归。
- RLS policy、RPC `SECURITY DEFINER`、Data API grants 与表级 ACL 的组合效果已在 apply 后完成只读核对；RLS 仍不替代 TRUNCATE ACL 防线。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | Supabase RLS/权限代理 | 只读 ACL/RLS/role evidence closure | linked 项目与权限查询 | 两表对象存在性、直接 ACL、权限矩阵、owner 和 membership 可追溯；当前已确认 P1 |
| WP-02 | PartsPro 业务契约代理、平台负责人 | 最小权限决策与兼容性清单 | WP-01；业务/运维使用场景 | 明确 anon/authenticated 必须移除的权限，以及 service_role/owner 保留或移除理由 |
| WP-03 | Supabase Migration 守门代理 | 权限 migration 草案与静态审查 | WP-02；老板批准 migration 设计 | 使用 `supabase migration new`，限定目标 relation，完成 SQL/ACL/RLS/安全审查；已完成 |
| WP-04 | Supabase Migration 守门代理、平台发布部 | linked history 与 dry-run 证据 | WP-03；老板批准只读 dry-run | history 无 divergence，dry-run 只列出本任务 migration；已完成并按顺序 apply |
| WP-05 | Supabase RLS/权限代理、PartsPro 业务契约代理 | 应用后权限回归与审计证据 | WP-04；老板明确批准 apply | `has_table_privilege`/`aclexplode`/RLS/membership 核对通过，必要业务读写未回归，service_role/owner 保留结论及审计证据完整；已完成 |

## 批准要求

- 是否需要老板批准：需要；本次 revoke、权限 migration 与 apply 已获老板明确批准并完成，后续扩大范围仍须另行批准。
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
- 本任务未将未批准的其他 DDL、DML、费用确认或部署描述为已完成；仅记录本任务两份 migration 的批准 apply。

## 禁止事项

- 本任务两份 migration 已完成；不得以本卡绕过审批执行其他 `REVOKE`、`GRANT`、DDL、DML、`apply_migration` 或生产写库。
- 不得预设 service_role 或 owner 全部 revoke；不得为“修复 P1”扩大到无证据的角色、schema、表或函数。
- 不得把 RLS、HTTP 401、dry-run 或本地 ACL 静态结果单独当作生产修复；本次结论以 apply 后双 ACL 证据为准。
- 不得修改运输成本 migration、应用代码、权限 TypeScript、Vercel 配置或无关任务文件。
- 不得回显、记录或复制任何 access token、secret、密码或业务数据行。

## 验证命令

本任务已执行批准后的 linked apply 与应用后验证；以下命令保留为可复核的执行记录：

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
| remote revoke/permission migration apply | passed | 老板明确批准后按唯一 `supabase db push --linked` 完成，目标 migration exit 0；未使用绕过参数 |
| linked dry-run | passed | apply 前仅列出目标 migration，顺序为权限 migration → transport migration |
| post-apply ACL double evidence | passed / GO | `has_table_privilege` 与 `aclexplode` 均确认两表 anon/authenticated 的目标 `TRUNCATE=false`；service_role 与 owner `postgres` 保留 `TRUNCATE=true`；其他必要表级权限未意外改变 |

## 回滚方案

- 权限 migration 已 apply；如需回滚，必须由 Supabase Migration 守门代理生成经审查的向前兼容反向 migration，不得临时恢复 anon/authenticated 的 `TRUNCATE`。
- 若后续批准 migration 后发现必要业务读写回归，先暂停受影响入口，保留审计证据，由 Supabase Migration 守门代理生成经审查的反向权限 migration；不得临时手工 `GRANT` 恢复。
- 反向 migration 只能恢复经过负责人确认的最小权限，不得默认恢复 anon/authenticated 的 `TRUNCATE`。
- 若发现已发生数据清空或成本层损坏，转入独立数据恢复/财务审计流程，不在本任务直接回填或覆盖事实。

## 残余风险

- service_role 与 owner 的 TRUNCATE 按批准矩阵保留；owner 具 bypassrls，RLS 仍不能作为其替代防线。
- anon/authenticated 的目标直接 TRUNCATE 已撤销，P1 已关闭；后续 ACL 漂移需重新审计。
- 手工 schema/ACL 漂移、同名 trigger/object 检查范围和 role membership 运行路径已完成本次核对，后续变更需回归。
- 权限 migration 的真实 SQL 执行、RLS/RPC/约束兼容性和应用后回归已完成本次核验。
- 供应商到货运输成本 migration 的 finance cost layer、历史 goods 语义和财务口径仍由原任务卡管理，不因本任务登记而自动批准。

## 执行记录

- 创建：2026-08-27，由 luna_worker 根据主代理派单创建；目标文件创建前确认不存在。
- 批准：老板明确批准本次生产权限 P1 的 migration apply；只应用本任务目标 migration，保留 service_role/postgres。
- 开始：2026-08-27，完成 linked catalog/privilege 只读核对。
- review：2026-08-27，确认两张现存表存在直接 TRUNCATE grant，RLS 不能防护；P1 确认。
- WP-03 local draft（2026-08-27）：按 CLI 创建 `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；SQL 仅撤销 `public.supplier_batches` 对 anon/authenticated 的 TRUNCATE 与 `public.finance_cost_layers` 对 authenticated 的 TRUNCATE，未预设撤销 service_role/postgres，未改变其他权限。
- 2026-08-27 migration ordering review（apply 前历史）：原权限 migration `20260827071053_revoke_supplier_batch_truncate_privileges.sql` → `20260825202034_revoke_supplier_batch_truncate_privileges.sql`；原因是 P1 权限修复必须先于运输成本 migration `20260825202035_supplier_batch_transport_costs.sql`。候选顺序固定为 `20260825202034` 权限 → `20260825202035` 运输；随后按新顺序完成 linked history/dry-run 与 apply。
- 2026-08-27 lineage reconciliation（apply 前历史）：connector fresh remote ledger 为 103 条；clean candidate（源自 origin/main）原缺 3 条已应用历史 migration。已按远端 `statements` 与 primary 同名 SQL 逐条核对并补入 clean candidate，作为已应用历史账本而非待执行 migration；随后 apply 后 ledger 完全对齐。
- 2026-08-27 fresh connector preflight（apply 前历史）：仅执行生产只读 SELECT/catalog 与 security/performance advisors；ACL 初始双证据、目标对象冲突、回填候选 382/382、模拟约束核对和锁/长事务均已记录，随后由生产 apply 与 post-check 取代。
- verified：linked history/dry-run、两份 migration production apply exit 0、ACL 双证据、RLS/membership 与必要权限回归均通过；P1 完成。
- released：不适用；本任务不发布
- closed：2026-08-27，P1 最小权限修复完成并经双 ACL 证据核验；service_role 与 owner `postgres` 保留。

## 结果

2026-08-27 生产 apply 结果：两份目标 migration 已在 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4` 生产项目按顺序 apply exit 0；apply 后 `supabase migration list --linked` exit 0，remote-only=0、local-only=0，ledger 完全对齐。
权限修复已完成：`has_table_privilege` 与 `aclexplode` 双证据均确认 anon/authenticated 的目标 `TRUNCATE=false`；`service_role` 与 owner `postgres` 保留已批准的 `TRUNCATE=true`，其他必要权限未意外改变。
该 P1 任务已关闭并置于 `done`；不包含其他 DDL/DML、费用确认、库存/价格变更或 Vercel 发布。

## 生产 apply 与应用后验证

- `20260825202034_revoke_supplier_batch_truncate_privileges.sql` 与 `20260825202035_supplier_batch_transport_costs.sql` 均在 `PartsPro-V4` apply exit 0，顺序为权限修复 → 运输成本。
- apply 后 migration ledger 完全对齐；`remote-only=0`、`local-only=0`。
- ACL 双证据（`has_table_privilege`、`aclexplode`）确认 anon/authenticated 的目标 `TRUNCATE=false`；service_role 与 owner `postgres` 的 `TRUNCATE=true` 按批准矩阵保留。
- schema/RLS/RPC/trigger/constraint/execute grants 独立复核为 `GO`；382/382 finance cost-layer backfill 候选无约束违规，charges/allocations 初始计数为 0。
- 本任务不包含 Git push、Vercel deploy、浏览器 smoke 或其他未批准生产写入。

## CLI linked/dry-run 证据（2026-08-27，apply 前历史快照）

- 持久 Supabase CLI 登录已成功；凭据仅保存在 CLI 用户级存储，未写入仓库、`.env` 或任务卡，也未回显或复制任何 secret。关闭初始 shell 后，在未设置 `SUPABASE_ACCESS_TOKEN` 的新 shell 中完成非敏感认证状态确认。
- linked target 精确为 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。
- `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` exit 0；remote-only=0；local-only 仅两份，顺序为 `20260825202034_revoke_supplier_batch_truncate_privileges` → `20260825202035_supplier_batch_transport_costs`。
- `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run` exit 0；dry-run 仅列出上述两份 migration，顺序相同；未执行非 dry-run、apply、repair、push 或 deploy。
- apply 前 migration 技术门为 `GO`；当时 apply 门状态为“技术门GO，等待Owner独立批准”。该历史快照不表示生产已修复；随后两份目标 migration 已按批准完成 apply 与应用后核验。
- 本次仅补充任务卡证据；源码、依赖、配置、目标 SQL 和测试未变化，既有定向测试、lint/build 证据可复用，未因文档变更重复运行。
- 状态说明：本节为 apply 前历史快照；当前以“生产 apply 与应用后验证”章节为准，P1 已关闭。
