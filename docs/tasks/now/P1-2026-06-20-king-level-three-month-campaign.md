# P1-2026-06-20-king-level-three-month-campaign

状态：released

看板目录：now

优先级：P1

Task ID：TASK-20260620-01

风险等级：R3

自治等级：L2

## 老板原始目标

然后帮我规划下 我想做活动 目前开始 新注册用户 自动升级等级到王者等级持续3个月
然后之前的客户也都升级为王者3个月 时间

Implement the proposed plan.

## 目标

从活动开始起，新注册客户和现有有效客户都获得 3 个月王者等级价格权益，到期后按累计消费重新计算等级。

## 业务影响

影响客户等级、商品价格解析、checkout 下单价格快照、订单等级快照、后台客户等级维护和个人中心等级展示。

## 完成定义

代码、migration、DTO 和 UI 均支持 3 个月王者等级活动；lint/build 通过；生产 migration 已通过安全门并应用，现有有效客户已被回填促销权益，新客户自动获得促销权益。

## 主责部门

价格与客户部

## 协作部门

- 订单运营部
- 平台发布部
- 文档审计部

## 工程守门代理

- PartsPro 业务契约代理
- Supabase Migration 守门代理
- Supabase RLS/权限代理
- Next.js 16 App Router 代理
- 前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 价格与客户部 |
| Approver | 老板 |
| Consulted | 订单运营部、平台发布部 |
| Informed | 文档审计部 |

## 涉及范围

- 页面：个人中心、checkout、后台账号管理
- API：后台账号 API、客户等级 RPC 调用返回
- 数据表/RPC：`public.customers`、`private.resolve_customer_product_price`、`private.create_order_transaction`、`public.resolve_customer_catalog_prices`、`public.admin_update_customer_level`
- 文档：本任务卡
- 外部系统：Supabase linked project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`

## 已知事实

- 王者等级固定每件减价为 EUR 1.50。
- 活动规则：现有有效分配客户获得王者 3 个月；新注册客户长期自动获得注册日起 3 个月王者。
- 到期后按累计消费额重新计算等级，不恢复旧手动等级。
- 员工自购资料和已归档客户不参与现有客户回填。

## 假设与未知项

- 当前活动不设置结束注册窗口；未来如要关闭，需要新增开关或撤销触发器。
- 生产 migration 含现有客户回填，必须由老板确认后才能应用。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 价格与客户部 | 客户促销等级字段和有效等级计算 | Supabase migration | 价格 resolver 使用促销等级 |
| WP-02 | 订单运营部 | checkout 下单和订单快照使用有效等级 | WP-01 | 订单创建函数使用 effective level |
| WP-03 | 前端体验代理 | 个人中心和后台账号显示活动到期提示 | WP-01 | UI 可见活动至日期 |
| WP-04 | 平台发布部 | lint/build 和 migration 安全门 | WP-01~03 | 生产应用前无 drift 阻塞 |

## 批准要求

- 是否需要老板批准：需要，生产 migration 包含现有客户回填。
- 是否需要 Supabase migration 安全门：需要。
- 是否需要 Vercel 发布门：需要，且不能早于数据库 migration 应用。
- 是否需要 PartsPro 业务契约验收：需要。

## 验收标准

- 新客户插入时自动写入 `promo_level='king'` 和 3 个月到期时间。
- 现有 active + assigned + real customer 回填王者活动 3 个月。
- 商品价格、catalog RPC、checkout 下单和订单快照均使用活动有效等级。
- 活动过期后按累计消费等级计算。
- 后台手动修改等级会清除促销字段，避免手动等级被过期促销逻辑覆盖。
- 个人中心和后台账号能显示活动到期时间。

## 禁止事项

- 不得在未确认生产 migration 回填影响前应用 migration。
- 不得先发布依赖 `promo_*` 字段的代码再应用数据库 migration。
- 不得把员工自购资料或已归档客户纳入现有客户活动回填。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无空白/补丁错误 |
| `npm run lint` | pass | ESLint 0 errors |
| `npm run build` | pass | Next.js build and TypeScript passed |
| Supabase MCP migration list | pass | 已应用 `20260620140014_customer_king_promo_3_months` 和 `20260620140151_customer_effective_level_search_path` |
| Supabase CLI linked dry-run | blocked | CLI 缺少 `SUPABASE_ACCESS_TOKEN`，改用 MCP migration tool，经老板确认后应用 |
| customers promo columns | pass | `promo_level`, `promo_level_starts_at`, `promo_level_expires_at`, `promo_level_reason` 均存在 |
| existing customer backfill | pass | 9 个现有 active + assigned real customer 回填 `promo_level='king'` |
| kyox120@gmail.com customer check | pass | effective level 为 `king`，活动到期 `2026-09-20 14:00:14 UTC` |
| Supabase security advisors | pass with existing warnings | 新增 `customer_effective_level` search_path warning 已用第二条 migration 修复；剩余 warnings 为历史 admin RPC/security definer、旧函数 search_path 和 Auth leaked password protection |

## 执行记录

- 创建：2026-06-20
- 批准：2026-06-20，老板确认
- 开始：2026-06-20
- review：2026-06-20
- verified：2026-06-20
- released：2026-06-20
- closed：待完成

## 结果

已实现代码和 migration，并已应用生产 Supabase migration。现有 9 个有效客户已获得王者 3 个月活动权益，新注册真实客户会自动获得注册日起 3 个月王者权益。残余风险：Supabase advisors 仍有历史安全/性能 warnings，未在本任务范围内清理。
