# P1-2026-07-01-admin-sold-stock-shortages

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260701-01

风险等级：R2

自治等级：L3

## 老板原始目标

帮我在后台再增加一个功能，就是在查看我最近卖出去的货有没有缺货的，就是只有卖出去的货，如果有缺货的话，我需要补货，所以我需要一个更直观的方式去查看。另加截图反馈：配件没了以后不要显示 0/0，要能看到例如 5/0，知道之前库存是五个然后全部没有了。

## 目标

在后台仓库面板提供只读的近期售出缺货/低库存补货视图。

## 业务影响

减少老板和仓库员工手动翻订单、商品库存的时间，优先补最近真实卖出去且已经缺货或低库存的 SKU。

## 完成定义

后台 `/admin?panel=inventory` 能查看最近 30 天已发货/已完成订单中售出的缺货或低库存 SKU，并显示期初估算库存到当前库存的变化。

## 主责部门

仓库库存部

## 协作部门

订单运营部、商品目录部

## 工程守门代理

Next.js 16 App Router 代理、PartsPro 业务契约代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 仓库库存部 |
| Approver | 老板 |
| Consulted | 订单运营部、商品目录部 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：`/admin?panel=inventory`
- API：`GET /api/admin/sold-stock-shortages`
- 数据表/RPC：`orders`、`order_lines`、`products`、`inventory_items`
- 文档：本任务卡
- 外部系统：无

## 已知事实

- 当前权限模型已有 `panel.inventory`，但后台仓库导航尚未绑定实际 panel。
- 订单行已有 `reserved_qty`、`fulfilled_qty`、`cancelled_qty` 等库存生命周期字段。
- 商品和库存可从 `products.stock_qty` 与 `inventory_items.available_qty` 聚合。

## 假设与未知项

- 最近售出默认按最近 30 天。
- 只统计 `shipped` 和 `completed` 订单。
- 低库存安全线默认 10。
- 期初库存 v1 使用估算值：当前可售库存 + 最近窗口内售出数。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | PartsPro 业务契约代理 | 只读 SKU 聚合 API | 订单与库存表 | API 返回正确 summary 和 rows |
| WP-02 | 前端体验代理 | 仓库补货面板 | WP-01 | 桌面和移动后台可读可筛选 |
| WP-03 | Next.js 代理 | 后台导航和动态面板接入 | WP-02 | `/admin?panel=inventory` 可直达 |

## 批准要求

- 是否需要老板批准：当前指令已批准规划落地
- 是否需要 Supabase migration 安全门：否，本次不新增 migration
- 是否需要 Vercel 发布门：若后续发布生产需要
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- 只出现最近窗口内真实卖过的 SKU。
- 当前缺货或低库存 SKU 才显示在列表。
- 缺货 SKU 显示类似 `5 -> 0` 的期初估算到当前库存。
- 仓库角色能打开面板，未授权用户不能访问 API。
- API 不返回客户资料、订单金额、地址等不必要信息。

## 禁止事项

- 不自动调整库存。
- 不自动创建采购或供应商到货记录。
- 不暴露 service role key 或客户敏感资料到浏览器。
- 不纳入无关的 `public/brand/` 未跟踪文件。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | passed | TypeScript check completed with exit code 0. |
| `git diff --check` | passed | No whitespace errors. |
| `npm run lint` | passed | ESLint completed with exit code 0. |
| `npm run build` | passed | Next.js 16 production build completed; `/api/admin/sold-stock-shortages` listed as dynamic route. |
| `curl -i /api/admin/sold-stock-shortages` | passed | Anonymous request returned `401 ADMIN_FORBIDDEN` with `missing_session`. |
| `curl -I /admin?panel=inventory` | passed | Admin inventory URL returned `200 OK` from local dev server. |

## 执行记录

- 创建：2026-07-01
- 开始：2026-07-01
- review：本地静态检查通过
- verified：本地 build 通过
- smoke：匿名 API 权限门和后台 URL 本地 smoke 通过

## 结果

已实现只读近期售出缺货补货视图。新后台仓库面板可通过 `/admin?panel=inventory` 打开，新 API 已验证匿名访问不会泄露数据。
