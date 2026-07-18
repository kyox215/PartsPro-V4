# P2-2026-07-18-admin-order-product-name-visibility

状态：closed

看板目录：done

优先级：P2

Task ID：TASK-20260718-01

风险等级：R2

自治等级：L3

## 老板原始目标

“这边的商品名称文字太长被遮挡，帮我解决一下，不能被遮挡。但是也不能压缩进行换行，比如说超过三行或者改变一行的上下高度。不要去改变这个高度。”随后批准开始执行、推送并部署应用。

## 目标

在不缩小字体、不增加订单商品行高度的前提下，让后台订单明细桌面表格完整保留并显示商品名称。

## 业务影响

提升订单拣货与履约核对的可读性，避免员工因商品名被省略而误认配件型号，同时保持现有高密度订单操作界面。

## 完成定义

订单明细桌面表格不再截断商品名称；空间不足时通过表格横向滚动访问完整内容；商品行高度、字号和数量状态列保持不变；代码通过 lint/build，推送远端并完成 Vercel 生产部署与 smoke test。

## 主责部门

订单运营部

## 协作部门

平台发布部、前端体验代理

## 工程守门代理

PartsPro 业务契约代理、Next.js 16 App Router 代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | Codex / 订单运营部 |
| Approver | Hexiang Huang |
| Consulted | PartsPro 业务契约、Next.js 16、前端体验、平台发布 |
| Informed | Chinatech 后台操作人员 |

## 涉及范围

- 页面：后台订单详情 / 订单明细桌面表格
- API：无
- 数据表/RPC：无
- 文档：本任务卡
- 外部系统：GitHub、Vercel

## 已知事实

- 桌面表格当前使用 `table-fixed`。
- 商品单元格同时使用 `max-w-0`、`overflow-hidden` 和 `truncate`，会强制显示省略号。
- shadcn `Table` 外层已经提供 `overflow-x-auto`。
- 移动端使用独立卡片布局，不属于截图中的问题。

## 假设与未知项

- 以当前生产订单数据中的长商品名和额外极限长名称完成响应式验收。
- 后台生产页面需要有效管理员会话；若自动化会话不可用，则以部署状态、公开 smoke 和代码级布局检查记录残余验证边界。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 订单运营部 | 商品名完整展示布局 | 当前订单表格 | 名称无省略号且行高不变 |
| WP-02 | 工程守门 | lint/build 与界面检查 | WP-01 | 验证通过或明确记录阻断 |
| WP-03 | 平台发布部 | Git 推送与 Vercel 生产发布 | WP-02 | 生产 READY 且 smoke 通过 |

## 批准要求

- 是否需要老板批准：是，已由老板明确批准执行、推送和部署
- 是否需要 Supabase migration 安全门：否，无数据库变更
- 是否需要 Vercel 发布门：是
- 是否需要 PartsPro 业务契约验收：是，仅核对订单显示字段未发生语义变化

## 验收标准

- 商品名称不再出现由当前组件产生的省略号或裁切。
- 商品名称保持单行、现有字号和现有行高。
- 容器不足时表格横向滚动，数量、实给、预留、履约、价格及操作列不被压缩。
- 移动端独立卡片布局无回归。
- `git diff --check`、目标文件 lint、完整 lint、生产 build 通过。
- 仅本任务文件进入提交，生产部署状态为 READY，并完成可执行的 smoke test。

## 禁止事项

- 不缩小商品名字号。
- 不通过三行以上换行增加商品行高度。
- 不修改订单、库存、价格、权限或 Supabase schema。
- 不纳入现有未跟踪 PWA 图片或其他无关改动。

## 验证命令

```bash
git diff --check
npx eslint src/components/partspro/admin-orders-panel.tsx
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无输出，退出码 0 |
| target ESLint | pass | `npx eslint src/components/partspro/admin-orders-panel.tsx`，退出码 0 |
| `npm run lint` | pass | ESLint 全量检查通过 |
| `npm run build` | pass | Next.js 16.2.6 编译、TypeScript、17 个静态页面生成全部通过 |
| 生产基线 | captured | 长名称可见宽度 284px、内容宽度 412px、`text-overflow: ellipsis`、商品行高度 69px |
| production smoke | pass | `c9d10a7` / `dpl_D3RXwsvBoAqNnZqHJY6QZL3nQ3iF` READY；`www.partspro.app/admin?panel=orders` 真实管理员会话通过 |
| production layout metrics | pass | 1280/1920 宽度下名称 412/412px 完整显示，`overflow: visible`、`text-overflow: clip`、行高保持 69px |
| horizontal access | pass | 表格容器 `overflow-x: auto`，实测可滚动 144px 并访问价格和操作列 |
| production observability | pass | 浏览器控制台无 warning/error；Vercel 15 分钟窗口无 runtime/build error |

## 执行记录

- 创建：2026-07-18，Codex
- 批准：2026-07-18，Hexiang Huang
- 开始：2026-07-18，Codex
- review：2026-07-18，定向 diff/ESLint 与订单显示契约检查通过
- verified：2026-07-18，全量 lint、生产 build 与生产基线采集通过
- released：2026-07-18，提交 `c9d10a7` 已推送 `origin/main`，Vercel production READY
- closed：2026-07-18，生产视觉、响应式、横向滚动和错误扫描全部通过

## 结果

商品名不再使用省略号或隐藏溢出，桌面订单明细改用内容驱动的单行表格布局；空间不足时由既有表格容器横向滚动。生产验证确认示例长名称完整显示，商品行仍为 69px，数量、履约、价格和操作列均可访问。无 API、数据库、权限或移动端布局变更，残余风险仅为窄容器需要横向滚动，符合已批准方案。
