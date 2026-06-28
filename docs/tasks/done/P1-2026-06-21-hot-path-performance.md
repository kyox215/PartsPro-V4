# P1-2026-06-21-hot-path-performance

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260621-01

风险等级：R2

自治等级：L3

## 老板原始目标

检查项目所有可以优化加载速度响应速度的地方，常操作的地方都为我进行优化。

## 目标

优化 PartsPro 常用前台和后台路径的加载速度、响应速度和重复请求开销。

## 业务影响

影响商品目录、首页、购物车/checkout、后台商品、订单、账号和供应商运营页面的日常使用效率。

## 完成定义

代码层完成可验证的热路径优化，数据库侧只新增非破坏性索引，并通过 lint/build 与 Supabase migration 安全门检查。

## 主责部门

平台发布部

## 协作部门

商品目录部、价格与客户部、订单运营部、仓库库存部、采购到货部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | Codex |
| Approver | Hexiang Huang |
| Consulted | PartsPro 业务契约代理 |
| Informed | 平台发布部、文档审计部 |

## 涉及范围

- 页面：首页、商品目录、后台商品、后台订单、后台账号
- API：`/api/me`、商品目录 repository、后台商品 repository
- API：`/api/me`、`/api/admin/overview`、商品目录 repository、后台商品 repository
- 数据表/RPC：`products`、`orders`、`profiles`、`customers`、`admin_list_products`
- 文档：本任务卡
- 外部系统：Supabase linked project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`

## 已知事实

- Next.js 16 `fetch` 默认不缓存，Route Handler 默认不缓存。
- 客户价格、订单、库存、权限属于强业务契约，不能用长缓存牺牲实时性。
- 现有迁移已覆盖部分商品搜索和首页目录索引。

## 假设与未知项

- 生产数据量足以让后台列表搜索和排序受索引影响。
- 远端 Supabase dry-run 可能发现旧 pending migration；如发生必须停止，不自动应用。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | Codex | 前端图片与公开目录缓存优化 | Next.js docs | lint/build 通过 |
| WP-02 | Codex | 后台商品与 `/api/me` 重复查询优化 | 现有 repository/auth 逻辑 | 类型检查通过 |
| WP-03 | Codex | 非破坏性索引 migration | Supabase docs/CLI | dry-run 不夹带旧 migration |
| WP-04 | Codex | 验证记录 | 项目脚本 | 证据写入任务卡 |

## 批准要求

- 是否需要老板批准：老板已要求实施；linked migration 已在安全门全部通过后应用。
- 是否需要 Supabase migration 安全门：需要。
- 是否需要 Vercel 发布门：本任务不自动发布；发布前需要。
- 是否需要 PartsPro 业务契约验收：需要，重点看价格、订单、库存、权限不被缓存误伤。

## 验收标准

- 图片优化不再被全局关闭，首页 banner 可走 Next Image 优化。
- 公开匿名目录页面有短 TTL 去重缓存，客户/批发价不进入该缓存。
- 后台商品列表不再重复查询补货计数。
- `/api/me` 不再重复读取当前用户和权限。
- 迁移只新增索引/扩展，不修改数据、不改 RLS、不改权限。

## 禁止事项

- 不缓存客户专属价格、订单状态、库存写入、权限检查。
- 不绕过 Supabase migration 安全门应用生产 migration。
- 不修改 RLS、grant/revoke 或 destructive SQL。
- 不覆盖其他代理或用户未提交改动。

## 验证命令

```bash
python3 /Users/kyox215/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-contract-scan.md --json /tmp/partspro-contract-scan.json
npx tsc --noEmit
git diff --check
npm run lint
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `python3 /Users/kyox215/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-contract-scan.md --json /tmp/partspro-contract-scan.json` | pass | PartsPro contract scan completed without blocking output. |
| `npx tsc --noEmit` | pass | TypeScript completed with no errors. |
| `git diff --check` | pass | No whitespace errors. |
| `npm run lint` | pass | ESLint completed with no errors. |
| `npm run build` | pass | Next.js 16.2.6 production build completed successfully. |
| `supabase migration list --linked` | pass | `20260620225241` is present locally and remotely after apply. |
| `supabase db push --linked --dry-run` | pass | Dry-run listed only `20260620225241_optimize_hot_path_queries.sql`. |
| `supabase db push --linked` | pass | Migration applied after qualifying `extensions.gin_trgm_ops`. |
| `supabase db query --linked ... pg_indexes` | pass | Remote returned all 9 expected index names. |
| Browser smoke `/`, `/catalogo`, `/carrello`, `/checkout`, `/admin` | pass | Pages rendered content, no Next error overlay, no console errors; `/admin` redirected to login when anonymous. |
| HTTP smoke `/api/me`, `/api/catalogo`, `/api/admin/products`, `/api/admin/orders` | pass | Anonymous `/api/me` 200, catalog 200 with 12/17874 products, admin APIs 401 missing_session as expected. |
| Catalog LCP image recheck | pass | First 4 catalog images now eager/high priority; no new server-side LCP warning after reload. |
| Authenticated admin login attempt | blocked | Provided email/password reached Supabase Auth in 467ms, but redirected to `/login?next=%2Fadmin&error=invalid`; no authenticated admin browser timings collected. |
| Admin overview chunk check | pass | `recharts` moved from `admin-overview-dashboard` into dynamic `admin-overview-charts`; overview dynamic chunk changed from `6147` 376K + `8692` 44K to `3408` 44K, with charts split into `2496`/`2811`. |
| Admin overview API smoke | pass | Added `/api/admin/overview`; anonymous request returns 401 `ADMIN_FORBIDDEN` with `missing_session`, preserving admin permission gate. |
| 2026-06-28 closeout recheck | pass | `contract_scan`、`npx tsc --noEmit`、`git diff --check`、`npm run lint`、`npm run build` 均通过；linked migration list 显示 `20260620225241` 已在 Local 和 Remote；dry-run 返回 remote database is up to date |
| 2026-06-28 local production HTTP smoke | pass | `next start` 后 `/`、`/catalogo`、`/carrello`、`/checkout`、`/admin` 均 200；`/api/me` 200；`/api/catalogo` 200 且 returned 24；`/api/admin/overview`、products、orders 均 401 `ADMIN_FORBIDDEN` |

## 执行记录

- 创建：2026-06-21，Codex 根据老板目标创建。
- 开始：2026-06-21。
- 修正：首次 push 发现远端 `gin_trgm_ops` 不在 search_path，已改为 `extensions.gin_trgm_ops` 后重新 dry-run。
- verified：2026-06-21，lint/build/migration list/dry-run/push/smoke query 通过。
- smoke：2026-06-21，启动本地预览并验证首页、目录、购物车、checkout、admin 登录重定向和关键 API。
- 优化追加：2026-06-21，smoke 时发现目录 LCP 图片提示，已将目录前 4 张商品图设为 eager/high priority 并重新通过 lint/build。
- 优化追加：2026-06-21，尝试已登录后台验证时 Supabase Auth 返回 `error=invalid`；改做代码级后台概览热路径优化，将 Recharts 图表拆成按需动态 chunk。
- 优化追加：2026-06-21，将后台概览页两个完整列表请求合并为 `/api/admin/overview` 单请求，并在服务端返回瘦身后的订单/商品 dashboard payload。
- closeout：2026-06-28，重新通过类型、lint、build、Supabase migration 状态和本地 production HTTP smoke；本次不执行 Vercel 发布。

## 结果

完成首页和后台 banner 图片优化、目录首屏商品图优先加载、公开匿名目录短 TTL 缓存、后台商品列表重复查询移除、`/api/me` 重复用户/权限读取移除、后台概览 Recharts 图表按需拆包、后台概览 API 合并/瘦身，以及账号/订单热路径索引迁移。linked Supabase migration 已应用到 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`；2026-06-28 已完成收尾复核并归档。
