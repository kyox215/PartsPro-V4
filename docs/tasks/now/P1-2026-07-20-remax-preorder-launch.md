# P1-2026-07-20-remax-preorder-launch

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260720-04

风险等级：R3（生产 migration 应用按 R4 守门）

自治等级：L3

## 老板原始目标

“在前端首页增加一个新的分区，上架专属产品 REMAX。即将到货的商品先上架并开始预定；现在没有货，但客户可以下单预定。完整规划后台人员操作，页面要简单，小白也能一下上手。开始按照计划设定目标并执行计划，完成后推送并应用。”

## 目标

交付一个不伪造现货、不会超卖、可审计且移动端易操作的 REMAX 预售闭环：表格预检/导入草稿、开放预售、客户下单、预订单处理、分批到货、按先后顺序分配库存，并在首页展示 REMAX 专区。

## 业务影响

- 在到货前开始接受 REMAX 订单，提前锁定需求和销售机会。
- 后台员工不需要理解数据库字段，可按“导入新品 → 处理预订单 → 确认到货”完成日常工作。
- 预售数量与真实库存分离，避免零库存商品被误当现货或到货前产生库存扣减。
- 到货、缺货、延期和取消均保留审计记录，降低客服和仓库出错概率。

## 完成定义

- 首页在主横幅之后显示 REMAX 预售专区；无可售 REMAX 商品时自动隐藏。
- REMAX 预售商品即使现货为 0，也能在容量范围内加入独立预售购物车并创建预订单。
- 预售订单不占用现货、不产生现货库存 movement；价格、ETA 和条款在下单时快照。
- 后台提供面向小白的 REMAX 预售中心，包括导入预检、商品状态、预订单队列、ETA 更新和到货确认预览。
- 表格导入先预检再确认；缺价格、缺图片、SKU 冲突等行不能静默发布。
- 到货确认原子增加真实库存，并按创建时间先后给预订单分配；部分到货可安全处理。
- migration、RLS/grant、RPC、lint、类型、build、数据库 smoke、浏览器 smoke 全部有证据。
- 本任务文件范围化提交并推送；linked Supabase migration 只在项目安全门通过后应用。

## 主责部门

商品目录部

## 协作部门

- 采购到货部
- 价格与客户部
- 订单运营部
- 仓库库存部
- 平台发布部
- 文档审计部

## 工程守门代理

- PartsPro 业务契约代理
- Next.js 16 App Router 代理
- Supabase Migration 守门代理
- Supabase RLS/权限代理
- 前端体验代理
- 供应商到货导入代理
- Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | 老板 |
| Consulted | 采购到货部、价格与客户部、订单运营部、仓库库存部、各工程守门代理 |
| Informed | 平台发布部、文档审计部 |

## 涉及范围

- 页面：首页、商品卡/详情、购物车、checkout、后台 REMAX 预售中心。
- API：REMAX 管理汇总、导入预检/应用、预售商品配置、预订单、ETA 更新、到货预览/确认。
- 数据表/RPC：`products`、`supplier_batches`、`supplier_batch_lines`、`orders`、`order_lines`、预售分配表、预售创建/导入/到货 RPC。
- 文档：任务卡、ADR、后台操作 runbook、表格模板字段说明。
- 外部系统：linked Supabase `yiuxrjqexlfjtxxrkqvi / PartsPro-V4`、GitHub、Vercel。

## 已知事实

- 当前商品卡和详情页在现货库存不足时禁用购买。
- 当前 `create_order_transaction` 会拒绝零库存/数量大于现货并立即形成库存预留。
- `inventory_items.incoming_qty` 已存在，但现有供应商批次没有正式 ETA/在途状态契约，`qty_ordered` 目前主要位于 metadata。
- 现有后台商品页另有未提交的“商品目录简化”改动，本任务必须保留且不混入提交。
- 用户尚未提供 REMAX 到货表，因此本任务交付可用导入入口和模板；实际商品行导入在收到文件后执行独立的批次 preflight。

## 假设与未知项

- V1 仅接受登录客户预订，付款方式为银行转账/待确认，不自动扣钱包。
- V1 不允许现货与预售商品混在同一订单；页面会明确引导分开结算。
- REMAX 专区按 `brand = REMAX` 且 `preorder_enabled = true` 识别；底层预售能力保持品牌通用。
- 预售容量为已确认采购数量减安全缓冲、有效预订单数量和已取消数量；实际库存始终独立。
- 实际 REMAX 价格规则由导入时明确选择；不会默默套用历史 Mobilax 的 `ceil(cost + 5)`。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | PartsPro 业务契约代理 | 预售状态、容量、价格、取消、到货分配契约 | 现有订单/库存迁移 | 所有状态和不变量可在 SQL/API/UI 一致表达 |
| WP-02 | Supabase Migration/RLS 守门代理 | 向后兼容 schema、索引、RLS/grant、原子 RPC | WP-01 | 不影响普通现货订单，防超卖并可回滚关闭 |
| WP-03 | 供应商到货导入代理 | 表格预检、批次草稿导入、到货预览/确认 | WP-02 | 重复批次/SKU 冲突被阻断，实际库存只在到货确认增加 |
| WP-04 | 前端体验代理 | 小白式后台 REMAX 中心 | WP-02、WP-03 | 一页一任务、移动端无横向滚动、错误含修正动作 |
| WP-05 | 订单运营部 | 预售商品卡、详情、独立购物车/checkout、成功页语义 | WP-02 | 零现货可在容量内下单，混合购物车被安全阻断 |
| WP-06 | 平台发布部 | lint/build/SQL/browser 验证、migration 应用、推送和线上 smoke | WP-01 至 WP-05 | 所有安全门通过且生产状态有证据 |

## 批准要求

- 是否需要老板批准：已批准执行、推送和应用；若 dry-run 出现旧 pending、权限重写或生产回填，仍按安全门暂停并再次报告。
- 是否需要 Supabase migration 安全门：是，R4。
- 是否需要 Vercel 发布门：是。
- 是否需要 PartsPro 业务契约验收：是。

## 验收标准

- 新员工 5 分钟内能找到 REMAX 中心并理解三项主任务。
- 导入预览明确显示可预售、需补资料、阻断三类，不直接修改数据库。
- 预售剩余量在数据库事务内计算，两个并发订单不能超过容量。
- 订单保存价格、ETA、预售条款快照；后续改商品不会改历史订单。
- 取消未分配预订单会释放容量；到货按先来先分，部分到货不丢失剩余等待量。
- 确认到货前显示库存增量、订单分配、剩余现货和异常；确认后写库存与审计。
- 普通现货下单、库存预留、取消/发货流程无回归。
- 首页无可售 REMAX 时不渲染空专区；有商品时 1/2/4 列响应式显示。
- 所有管理写接口在服务端重新检查权限，客户端隐藏不作为授权。

## 禁止事项

- 不把预计到货数量写入 `products.stock_qty`、`actual_qty` 或 `available_qty`。
- 不为预售订单创建现货 reservation 或虚假库存 movement。
- 不允许混合现货/预售订单、超卖、负数量、负价格或无 ETA 的自动发布。
- 不静默覆盖已有 SKU、批次、价格、图片、库存或用户未提交改动。
- 不自动应用旧 pending migration，不执行 `db reset --linked`、`migration repair`、破坏性 SQL 或生产数据批量回填。
- 不提交重复 PWA 图标和现有“商品目录简化”任务文件/改动。

## 验证命令

```bash
python3 ~/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-remax-contract-scan.md --json /tmp/partspro-remax-contract-scan.json
git diff --check
npm run lint
npx tsc --noEmit
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

补充验证：

```text
- SQL：表/列/约束/索引、RLS、grants、RPC execute、并发容量、取消释放、部分到货分配。
- API：未登录、无权限、无效表格、重复批次、SKU 冲突、重复提交、正常创建/更新/到货。
- 浏览器：390x844 与 1440x900；首页、商品详情、购物车/checkout、后台三条主流程。
- 发布：目标 commit 的 Vercel deployment READY，公开首页/商品路径和后台鉴权 smoke 正常。
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 最终 contract scan | passed | `/private/tmp/partspro-remax-contract-scan.md`；识别 `order_line_preorder_allocations` 及 `20260720002209_remax_preorder_center.sql` |
| `git diff --check` | passed | 2026-07-20，退出码 0 |
| `npm run lint` | passed | 2026-07-20，ESLint 退出码 0 |
| `npx tsc --noEmit` | passed | 2026-07-20，退出码 0 |
| `npm run build` | passed | Next.js 16.2.6 production build；包含 `/admin/remax` 和 6 个 REMAX API 路由 |
| migration history / dry-run | blocked | 非本任务的 Mobilax migration 已独立重编号为 `20260720001643` 并应用；REMAX 已用 CLI 重编号到其后。当前只剩 CLI 缺少 `SUPABASE_ACCESS_TOKEN`，无法执行强制 linked history / dry-run 门禁 |
| isolated SQL smoke | passed | 隔离 Supabase 实例完整应用同一 SQL（SHA-256 `3da848c5899946a30bcc493e303944a03645806310109fde2f8d004f96098a78`）；通过权限、容量、下单、部分到货、幂等和取消释放事务 smoke，最后 rollback |
| browser mobile / desktop | passed | 1440x900 与 390x844 首页均无横向溢出；未登录 `/admin/remax` 跳转 `/login?next=/admin/remax`；控制台 0 error/warning |
| linked SQL smoke | blocked | 生产 migration 未应用，不能把隔离实例结果冒充 linked 结果 |
| Vercel production | pending | 代码推送后检查目标 commit deployment；REMAX 数据库能力在 migration 安全门解除前保持关闭 |

## 执行记录

- 创建：2026-07-20
- 批准：2026-07-20，老板要求按已确认计划执行、推送并应用。
- 开始：2026-07-20
- review：2026-07-20，完成前后端业务契约、权限、导入/到货和响应式 UI 复核。
- verified：2026-07-20，代码、构建、隔离数据库和浏览器验证通过；linked migration 安全门未通过。
- migration 重编号：2026-07-20，因并发 Mobilax migration 先应用，使用 `supabase migration new` 将未应用的 REMAX SQL 从 `20260720000827` 安全重编号为 `20260720002209`；SQL SHA-256 保持不变。
- released：
- closed：

## 结果

代码已推送；生产数据库尚未应用。非本任务 pending 已独立处理，解除 CLI 认证后重新执行 linked history、dry-run、apply 和 linked smoke，才能关闭任务。
