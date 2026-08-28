# P2-2026-08-28-device-model-normalization-review

状态：verified（数据库）；代码/Vercel pending

优先级：P2

Task ID：TASK-20260828-01

风险等级：R3

自治等级：L2

## 老板原始目标

列表有很多有2个的型号显示，比如 A16 5G 和 A166 是一个型号，研究现有列表是否都正确并给出修复规划。

## 目标

在 Owner 已授权的范围内，为高置信型号 alias/code/格式污染建立可回滚的 canonical 显示/搜索投影，并准备生产 migration apply 与 scoped main deploy；保留 194 条 unmatched legacy 与真实 variant，不扩大到未授权的数据修复。

## 业务影响

影响前台型号导航、配件兼容搜索和维修人员选型；本批只改变 view 投影语义，不改变商品、PDC、库存、价格、订单、锁货、权限或发布状态。migration apply 与 scoped main deploy 已获授权，但必须依次通过 Supabase、独立审查和 Vercel 门禁，失败即停止。

## 完成定义

CSV 覆盖当前全部 462 个非空菜单型号行；JSON/Markdown/Workbook 计数一致；48 行仅作为显示/搜索投影 approved，414 行保持 pending_owner_review；所有 inventory_action 为 none；Owner 已批准 48 行 display/search projection、production migration apply 和 scoped main deploy；数据库 migration 已 apply 并完成生产只读验收，代码/Vercel 仍 pending，未提前标记 released/closed，且回滚边界可审查。

## 主责部门

商品目录部

## 协作部门

采购到货部；文档审计部

## 工程守门代理

PartsPro 业务契约守门

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | Owner/老板 |
| Consulted | 采购到货部、PartsPro 业务契约守门 |
| Informed | 文档审计部 |

## 涉及范围

- 页面：`src/app/catalogo/page.tsx`、`src/components/partspro/catalog-brand-tree.tsx`
- API/Repository：`src/lib/partspro-repository.ts`
- 数据表/视图：`device_models`、`product_device_compatibilities`、`products.compatibility_models`、`catalog_product_device_models`、`catalog_model_options`
- 文档：本任务审计目录、Owner 审批工作簿
- 外部系统：Samsung 官方支持/产品页，仅作为证据

## 已知事实

- 生产项目：yiuxrjqexlfjtxxrkqvi / PartsPro-V4；读取成功。
- 当前菜单：462 行、14 品牌。
- canonical device_models：223 个 active identity。
- code suffix 重复：39 组/80 行。
- case/punctuation 重复：10 组/20 行。
- 生产业务数据写入：0；本次仅执行三个 catalog view 的 DDL replacement。
- release clean worktree：`/private/tmp/partspro-device-normalization-release-20260828`，基于最新 `origin/main` SHA `241c9de45a9408cb306cbf42c4014d8cd04f3a39`；主工作树的无关脏改动未触碰。
- 迁移：`20260828105427_catalog_model_display_projection.sql` 已由 `supabase migration new` 创建并在 PartsPro-V4 生产 apply；审查 FAIL 后已替换为冻结的 48 行 exact-match display-only 白名单，禁止线上动态推断。
- 回滚：`supabase/rollbacks/20260828105427_catalog_model_display_projection_rollback.sql` 可恢复最新基线的三个 security-invoker view 定义与列契约，未执行。
- 本批高置信显示/搜索投影：48 行；unmatched legacy：194 行，继续 pending；194 行及 PDC/products.compatibility_models/device_models/库存数据修复不在授权范围。
- 生产结果：catalog menu 462 → 417；`catalog_product_device_models` 投影 885；45 行 legacy 折叠、3 行 Wiko 只改显示前缀；A16/A17 的 4G/5G 四个 canonical 保持分离。
- 生产业务数据写入：0；CSV/JSON/XLSX 台账维持 48 approved / 414 pending，未重新导出工作簿。

## 假设与未知项

- unmatched legacy 值没有足够证据时不自动映射。
- legacy 数组可能包含同一商品的历史导入值；需 Owner 审批后才能迁移到 PDC。
- release clean worktree 已通过 `migration list --linked` 与 `db push --linked --dry-run`；远端历史无 divergence，dry-run 仅列本批 migration；生产 apply 后 migration list 已登记 `20260828105427`。
- 本批只做 view projection；真实 PDC/产品兼容关系仍需后续单独审批任务。
- 本轮生产 `supabase db push --linked` 在用户明确确认后成功完成；未改用 MCP 或其他绕过路径，未执行任何业务数据 DML。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 商品目录部 | 生产只读快照与逐行 CSV | Supabase MCP 只读 | 已完成：行数等于 catalog_model_options 非空行数 |
| WP-02 | 商品目录部/采购到货部 | Owner 映射候选与重复组 | WP-01 | 已完成：每行有分类、证据、decision |
| WP-03 | 平台发布部/商品目录部 | 最小可逆 catalog view projection + 回归 SQL | WP-02 | 独立审查 FAIL 后已修正：冻结白名单、强断言 smoke、rollback、静态契约测试；Supabase apply 与生产 smoke 已通过 |
| WP-04 | 文档审计部 | JSON/Markdown/任务卡/Workbook | WP-02/WP-03 | CSV/JSON/Markdown/Workbook 已同步；本轮仅更新任务卡，不改 CSV/XLSX；Owner 范围批准已完成 |
| WP-05 | PartsPro 业务契约守门 | 只读验收与发布前门禁 | WP-03/WP-04 | Supabase/独立审查门已通过；Vercel 门 pending；无业务数据写入，库存动作全为 none |

## 批准要求

- 是否需要老板批准：范围批准已完成；48 行仅作为 display/search projection，production migration apply 与 scoped main deploy 已获授权；194 unmatched 及基础数据修复仍未授权。
- 是否需要 Supabase migration 安全门：是；已通过 linked list/dry-run、lint/build、独立审查、用户明确确认与生产数据不变式；apply 后只读验收通过。
- 是否需要 Vercel 发布门：是；仅允许本 scoped change 通过构建和发布验证后部署，不提前标记 released。
- 是否需要 PartsPro 业务契约验收：是。

## 验收标准

- CSV 数据行数 462，唯一键为 `(catalog_department,current_brand,raw_model,raw_model_series)`。
- decision 只使用 `pending_owner_review|approved|rejected|not_common`；48 行 approved 仅为 display/search projection，414 行保持 pending。
- inventory_action 全部为 `none`。
- Summary 公式引用 Model Review；Duplicate Groups 覆盖全部 49 个重复组。
- A16/A17 使用官方 Samsung URL；4G/5G 不合并。
- migration 仅重定义三个 security-invoker catalog view；canonical/alias/code 输入命中同一商品集合，unmatched 不自动映射。
- migration 仅按 brand + exact raw key 查询冻结 48 行白名单；不得使用 regexp/lower 扫描或动态 `device_models` 候选推断；legacy 的 `device_model_id` 与 `normalized_key` 始终为 NULL。
- 回归 SQL 覆盖 A16/A165、A16/A166、A17/A175、A17/A176、4G/5G 分离、unmatched 保护以及商品/库存不变式采集。
- 生产业务数据写入为 0；本次仅替换三个 catalog view 定义。

## 禁止事项

- 不自动批准 unmatched、短代码、多义代码或仅凭字符串相似的关系。
- 不删除/覆盖产品、SKU、库存、价格、订单、锁货、RLS 或发布状态。
- 不直接修改 products.compatibility_models、product_device_compatibilities 或 device_models；不将 48 行 display/search 授权扩大为 unmatched/PDC/库存数据修复。
- 当前未通过门禁前不得 apply/push/deploy；授权范围内的 production migration apply 与 scoped main deploy 必须依次通过 linked/auth/DNS/remote-only divergence、独立审查和 Vercel 门，任一失败即停止，不提前标记 released。
- 不将显示投影 approved 解释为产品兼容性批准；不提交其他代理的改动。

## 验证命令

```bash
git diff --check
node --test tests/device-model-display-projection.contract.test.mjs
python3 ~/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /private/tmp/TASK-20260828-01-contract-scan-release.md --json /private/tmp/TASK-20260828-01-contract-scan-release.json
supabase migration list --linked
supabase db push --linked --dry-run
npm run lint
npm run build
```

artifact-tool 一次性生成/导入/公式扫描与四表渲染，证据见下方“验证证据”表；本轮未编辑工作簿且未再次运行 artifact operation marker。生产 migration apply 与 post-apply 只读验收已通过，代码/Vercel 发布仍 pending。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| Supabase project read | passed | `yiuxrjqexlfjtxxrkqvi / PartsPro-V4` |
| catalog_model_options snapshot | passed | 462 rows |
| CSV key/decision/inventory checks | passed | generated by builder |
| migration creation | passed | `supabase migration new catalog_model_display_projection`; `20260828105427_catalog_model_display_projection.sql` created |
| latest-base release worktree | passed | `/private/tmp/partspro-device-normalization-release-20260828`; `origin/main` `241c9de45a9408cb306cbf42c4014d8cd04f3a39` |
| frozen whitelist contract | passed | static test parses SQL and CSV: 48/48 exact rows, 45 legacy + 3 brand-prefix, normalized keys unique |
| projection contract test | passed | `node --test tests/device-model-display-projection.contract.test.mjs` — 7/7; includes rollback and fail-closed smoke assertions |
| fullstack contract scan | passed with scanner limitation | `/private/tmp/TASK-20260828-01-contract-scan-release.md/json`; scanner is Vue/Vite-oriented and reported no service/type files for this Next.js tree |
| production post-apply read-only verification | passed | strong smoke SQL passed; projection 885, menu 417, normalized duplicate identity groups 0, Samsung A16/A17 menu rows 4, Wiko rows 3, A16 5G filter count 3; all 194 audited unmatched options matched and remained visible; 9/9 raw/canonical product sets equal; legacy device_model_id/normalized_key non-null violations 0 |
| production catalog EXPLAIN ANALYZE | passed | three samples/ranges after apply: projection 41.048–41.415 ms (885 rows), menu 44.700–45.962 ms (417 rows), Samsung A16 5G filter 63.952–66.408 ms (3 rows); no migration DML |
| rollback static validation | passed | rollback restores three baseline views/security-invoker/column contract; no DML or privilege operations |
| workbook formula/render checks | passed | artifact-tool import: Summary formulas B5:B19; formula error scan matched 0; all four required sheets rendered and visually checked |
| linked migration list/dry-run | passed, read-only | linked to `yiuxrjqexlfjtxxrkqvi` / PartsPro-V4; all remote migrations match local history, no remote-only divergence; dry-run listed only `20260828105427_catalog_model_display_projection.sql` |
| production migration apply | passed | after explicit Owner confirmation, `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked` applied `20260828105427_catalog_model_display_projection.sql`; post-apply migration list shows local=remote `20260828105427` |
| lint/build | passed | latest-base release worktree: `node --test ...` 7/7, `npm run lint`, `npm run build`, and `git diff --check` all passed |
| production write/invariant check | passed | products 678/1702 and inventory 17961/1705/38/1743 unchanged; no product, PDC, inventory, price, order, grant or RLS DML |
| Supabase advisors | passed, scoped clean | security 64 (INFO 5/WARN 59), performance 129 (INFO 118/WARN 11); scoped entries for the three catalog views/migration 0; counts match known baseline |

## 执行记录

- 创建：2026-08-28
- 批准：Owner 范围批准已完成（48 行 display/search projection、production migration apply、scoped main deploy）；194 unmatched、PDC/products.compatibility_models/device_models/库存修复未授权
- 开始：2026-08-28；老板明确授权从任务开始推进至上线部署。当前执行仍遵守 Supabase/独立审查/Vercel 门禁：Supabase migration 已 apply 并通过生产只读验收，代码/Vercel 发布仍 pending；显示投影 approved 不等同于产品兼容关系批准
- 独立审查：2026-08-28；首版因线上动态 canonical/alias/code/regexp 推断、弱断言 smoke、缺少可执行 rollback 被判 FAIL；已在最新 `origin/main` clean worktree 重新修正为冻结 48 行白名单、强断言 smoke 与 rollback。
- review：2026-08-28
- verified：2026-08-28（修正版技术验证与生产数据库验收完成；静态 7/7、扫描、生产 smoke、9/9 集合、194 unmatched、性能区间、advisors、lint/build 及 linked list/dry-run 通过；代码/Vercel 发布待完成）
- released：不适用
- closed：待发布观察/最终验收

## 结果

本阶段交付 48 行高置信显示/搜索投影处理、414 行 pending 映射台账、冻结 exact-match view migration、强断言回归 SQL 与可执行 rollback；不执行未授权的数据修复。生产 apply 后验证目标为菜单 417、投影 885、A16/A17 四种网络/代际变体分离、A16 5G 3 个商品、9/9 集合一致、194 unmatched 全部保留；商品/库存不变量、ACL/security-invoker 和 advisors 均通过。代码/Vercel scoped 发布仍 pending，任一发布门失败即停止且不标 released，真实 PDC/产品兼容关系变更与库存动作保持未授权/none。
