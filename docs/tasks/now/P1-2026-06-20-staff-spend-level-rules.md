# P1-2026-06-20-staff-spend-level-rules

状态：verified

看板目录：now

优先级：P1

Task ID：TASK-20260620-02

风险等级：R3

自治等级：L3

## 老板原始目标

管理员不参与活动一直保持最高等级。员工帐号也是改为员工帐号后就升级为最高点等级，都是保持原来的等级然后进行购物后慢慢继续计算增加等级的金额，如果哪天改为客户就恢复之前的等级但是在员工职位时下单后端金额还是加上去去计算等级进行更新。

后续确认：员工不自动最高等级，员工等级由管理员手动调；员工期间下单金额继续累计到原客户等级。只有 kyox120@gmail.com 永久最高等级。

## 目标

把员工/管理员/活动客户等级规则落到数据库闭环，保证临时活动、手动等级和员工消费累计互不污染。

## 业务影响

影响客户等级、价格权限、checkout 折扣、账号类型切换、订单支付后的累计金额和后台客户资料显示。

## 完成定义

生产数据库函数和数据完成更新：kyox120@gmail.com 永久手动 King 且无临时 promo；非 kyox 员工自动等级不因员工身份升 King；员工自购订单会累计到原客户身份；普通客户 3 个月 King 活动继续有效。

## 主责部门

价格与客户部

## 协作部门

订单运营部、平台发布部、文档审计部

## 工程守门代理

PartsPro 业务契约代理、Supabase Migration 守门代理、Supabase RLS/权限代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 价格与客户部 |
| Approver | Hexiang Huang |
| Consulted | 订单运营部、Supabase Migration 守门代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：后台账号/客户等级展示、客户 checkout 价格展示
- API：客户等级、账号类型切换、订单创建后的等级重算
- 数据表/RPC：`public.customers`、`public.profiles`、`public.orders`、`public.admin_audit_events`、`private.recalculate_customer_level*`、`public.admin_update_account_type`、migration `20260620165404_staff_spend_level_rules`
- 文档：本任务卡
- 外部系统：Supabase linked project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`

## 已知事实

- 3 个月 King 活动已经上线，普通客户活动需要保留。
- 旧账号类型切换函数会把原客户等级复制到 `employee_self`，和新规则冲突。
- 订单等级重算原来只看当前 `orders.customer_id`，员工自购订单不会自动回写原客户身份。
- kyox120@gmail.com 需要永久手动 King，不能作为临时活动客户。

## 假设与未知项

- 员工自购身份与原客户身份通过相同 `user_id` 关联。
- 员工手动等级继续由后台 `admin_update_customer_level` 管理。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 价格与客户部 | migration 更新等级重算和账号切换规则 | 老板确认规则 | 本地 lint/build 通过 |
| WP-02 | Supabase Migration 守门代理 | 远端 migration 应用和数据核对 | WP-01 | linked 数据状态符合验收 |
| WP-03 | 文档审计部 | 任务卡和验证证据 | WP-02 | 证据补齐 |

## 批准要求

- 是否需要老板批准：已确认
- 是否需要 Supabase migration 安全门：需要
- 是否需要 Vercel 发布门：不需要，除非后续前端代码变化
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- `kyox120@gmail.com` 相关客户行：`level/tier=king`、`level_source=manual`、`promo_*` 为空。
- 非 kyox 的 `employee_self` 自动等级按消费金额计算，不因员工身份自动 King。
- 员工订单触发重算时，原客户身份的 `lifetime_spend_net` 包含同 user 的 `employee_self` paid 订单。
- 普通客户活动 promo 仍保留，有效价格等级继续可到 King，基础等级恢复为活动前等级或消费等级。
- 本地 `git diff --check`、`npm run lint`、`npm run build` 通过。

## 禁止事项

- 不删除订单、客户、资料历史。
- 不把所有员工统一手动 King。
- 不自动 Vercel deploy。
- 不使用破坏性 Supabase 操作绕过 migration 安全门。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | passed | no whitespace errors |
| `npm run lint` | passed | `eslint` exited 0 |
| `npm run build` | passed | Next.js 16.2.6 webpack build completed |
| Supabase migration apply | passed | remote version `20260620165404 staff_spend_level_rules` |
| Supabase data smoke checks | passed | kyox manual King with no promo; 3 non-kyox employee_self rows automatic bronze/no promo; 8 active promo customers still effective King; order trigger points to new family recalculation function |

## 执行记录

- 创建：2026-06-20
- 批准：2026-06-20，老板确认实施并确认员工不自动最高等级
- 开始：2026-06-20
- review：2026-06-20，本地 diff/lint/build 通过，等待 Supabase 远端应用与 smoke check
- verified：2026-06-20，远端 migration 和数据 smoke check 通过
- released：
- closed：

## 结果

已交付 Supabase migration `20260620165404_staff_spend_level_rules`：

- kyox120@gmail.com 改为永久手动 King，清空临时 promo 字段。
- 非 kyox 员工自购档案不再自动 King，自动等级按消费金额计算；员工手动等级保留给管理员调整。
- 员工自购订单触发等级重算时，同步重算同账号原客户身份，使员工期间 paid 订单金额计入客户等级成长。
- 普通客户 3 个月 King 活动保留，有效价格等级继续由 promo 控制。

残余风险：当前生产库没有现有 `employee_self` 订单，员工订单累计闭环已通过触发器/函数结构检查验证，未用生产造单做动态写入测试。
