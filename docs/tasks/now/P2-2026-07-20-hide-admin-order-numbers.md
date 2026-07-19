# P2-2026-07-20-hide-admin-order-numbers

状态：verified

看板目录：now

优先级：P2

Task ID：TASK-20260720-01

风险等级：R2

自治等级：L3

## 老板原始目标

“帮我改下页面，这些订单号尽量不显示在这边，保持简洁直观。给我一份可行的规划然后开始执行，完成后推送以及应用。”

## 目标

隐藏后台移动订单卡片和新订单通知中的长订单号，让高频列表更简洁，同时保留订单详情、搜索、路由和审计所需的完整标识。

## 业务影响

降低移动端订单操作界面的视觉噪音，让员工优先看到客户、金额、商品数和处理状态；订单定位与内部数据契约保持不变。

## 完成定义

移动订单卡片不再显示短订单号；新订单通知列表（含历史事件）与后续浏览器推送不再显示订单号；点击通知与订单卡片仍能打开正确订单；lint/build、定向页面核验、推送和生产发布通过。

## 主责部门

订单运营部

## 协作部门

前端体验代理、平台发布部

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

- 页面：后台移动订单卡片、通知中心
- API：无接口形状变更；复用通知事件现有 `eventType`
- 数据表/RPC：无
- 文档：本任务卡
- 外部系统：GitHub、Vercel

## 已知事实

- 移动订单卡片当前在客户名下方渲染 `shortOrderId(order.id)`。
- 新订单通知事件已经返回 `eventType: "new_order"`，但客户端没有读取它。
- 新订单事件的 `payload`、`sourceId` 和 `targetPath` 已保存订单号，可在不展示标题编号的情况下继续准确跳转。
- 当前工作树包含另一项商品兼容性任务的未提交改动，必须隔离提交。

## 假设与未知项

- “这些订单号”指截图标注的移动订单卡片编号和新订单通知标题编号，不包含详情页、桌面订单表格、打印、导出或客户订单页。
- Vercel 项目继续使用 `main` 的生产发布流程；发布后用可用的管理员会话完成定向核验。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 订单运营部 | 两个紧凑入口隐藏订单号 | 当前组件与通知事件契约 | 视觉编号消失且点击定位不变 |
| WP-02 | 工程守门 | lint/build 与代码级契约检查 | WP-01 | 全部通过或记录明确阻断 |
| WP-03 | 平台发布部 | 隔离提交、推送、生产发布与 smoke | WP-02 | 生产 READY 且目标页面核验通过 |

## 批准要求

- 是否需要老板批准：是，老板已在原始派单中明确批准执行、推送和应用
- 是否需要 Supabase migration 安全门：否，无数据库变更
- 是否需要 Vercel 发布门：是
- 是否需要 PartsPro 业务契约验收：是，确认订单标识只从紧凑展示层移除

## 验收标准

- 移动订单卡片客户名下方不再出现 `#190726-...` 类编号。
- 新订单通知标题仅显示“新订单”/对应界面语言，不再附带 `PP-...`。
- 已存在的 `new_order` 通知也通过事件类型在界面隐藏旧标题中的编号。
- 新通知仍保留订单号于 payload/source/target，点击后仍可打开订单。
- 详情、桌面表格、搜索、打印、导出和数据库契约不变。
- `git diff --check`、目标 ESLint、完整 lint、生产 build 与生产 smoke 通过。
- 仅本任务文件进入提交并推送到 `origin/main`。

## 禁止事项

- 不删除或重写订单号数据。
- 不修改订单创建、搜索、详情路由或数据库 schema。
- 不隐藏详情页、打印、导出等需要订单号的业务位置。
- 不纳入商品兼容性任务或其他现有未提交改动。

## 验证命令

```bash
git diff --check
npx eslint src/components/partspro/admin-orders-panel.tsx src/components/partspro/notification-center.tsx src/lib/partspro-notifications.ts
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无输出，退出码 0 |
| target ESLint | pass | 三个目标源码文件检查通过，退出码 0 |
| `npm run lint` | pass | ESLint 全量检查通过 |
| `npm run build` | pass | Next.js 16.2.6 编译、TypeScript 与 17 个静态页面生成通过 |
| production smoke | pending |  |

## 执行记录

- 创建：2026-07-20，Codex
- 批准：2026-07-20，Hexiang Huang（原始派单明确要求开始执行、推送以及应用）
- 开始：2026-07-20，Codex
- review：2026-07-20，定向 diff、订单显示契约与通知跳转字段检查通过
- verified：2026-07-20，目标 ESLint、全量 lint 与生产 build 通过
- released：
- closed：

## 结果

执行中。
