# P1-2026-07-20-cart-gate-reason-dialog

状态：ready_for_release

看板目录：now

优先级：P1

Task ID：TASK-20260720-02

风险等级：R2

自治等级：L3

## 老板原始目标

“那帮我加上 点击灰色购物车时 显示原因的弹窗提示 帮我规划一下”以及“开始执行计划 完成后推送并应用”。

## 目标

让商品卡片中不可加购的灰色购物车按钮可以打开准确的原因弹窗，并为可修复的账号状态提供资料补全入口。

## 业务影响

减少员工和客户在商品目录看到价格但无法加购时的困惑，明确区分账号、价格与库存原因，改善订单转化与客服排障效率。

## 完成定义

- 灰色购物车保持原布局和视觉，但点击后只打开原因弹窗，不执行加购。
- `qqstore2020@gmail.com` 的员工自购资料不完整状态显示准确原因和缺失字段。
- 弹窗可跳转 `/account?setup=1` 补全资料。
- 正常加购、登录入口、补货提醒和客户审核提示不回归。
- lint、TypeScript、build、浏览器验证通过，任务提交推送到 `main`，Vercel 生产部署达到 READY 并完成 smoke test。

## 主责部门

订单运营部

## 协作部门

- 价格与客户部
- 平台发布部

## 工程守门代理

- PartsPro 业务契约代理
- Next.js 16 App Router 代理
- 前端体验代理
- Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 订单运营部 |
| Approver | 老板 |
| Consulted | 价格与客户部、PartsPro 业务契约代理、前端体验代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：首页、商品目录、个人中心资料编辑入口
- API：无新增 API
- 数据表/RPC：无 schema 或数据写入变更
- 文档：本任务卡
- 外部系统：Vercel Git 部署

## 已知事实

- 商品卡片目前通过原生 `disabled` 渲染灰色购物车，因此不能响应点击。
- `qqstore2020@gmail.com` 是员工账号，员工自购资料缺少电话、税号、账单地址和收货地址。
- 价格可见原因对员工统一返回 `employee`，不能直接表达购物车禁用原因。

## 假设与未知项

- 本任务不改变任何账号、价格、库存或订单资格规则，只解释现有规则。
- Vercel 已配置 `main` 分支 Git 自动生产部署；推送后以实际部署状态为准。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | PartsPro 业务契约代理 | 购物车禁用原因与缺失字段契约 | 当前账号上下文 | 原因覆盖客户、员工与商品价格状态 |
| WP-02 | 前端体验代理 | 可点击灰色购物车、原因弹窗、中意双语文案 | WP-01 | 不加购、可键盘操作、移动端布局不变 |
| WP-03 | Next.js 16 App Router 代理 | Server Component 到 Client Component 状态传递 | WP-01 | Props 可序列化且不新增客户端数据请求 |
| WP-04 | Vercel 发布代理 | 构建、推送、生产验证 | WP-02、WP-03 | READY 且生产 smoke test 通过 |

## 批准要求

- 是否需要老板批准：已通过“开始执行计划”批准
- 是否需要 Supabase migration 安全门：否
- 是否需要 Vercel 发布门：是
- 是否需要 PartsPro 业务契约验收：是

## 验收标准

- 员工自购资料不完整时，灰色购物车弹窗显示准确缺失字段。
- 弹窗“去补全资料”进入个人中心并自动打开资料编辑器。
- 商品价格未设置时显示价格原因，不误报账号问题。
- 点击受限按钮不会写入本地或远端购物车。
- 游客登录、客户账号提示、缺货补货提醒、正常加购行为保持不变。

## 禁止事项

- 不修改 `qqstore` 或其他生产账号资料。
- 不新增或应用 Supabase migration。
- 不改变价格、库存、MOQ、订单资格或权限规则。
- 不提交现有无关 PWA 图标文件。

## 验证命令

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无空白错误 |
| `npm run lint` | pass | ESLint exit 0 |
| `npx tsc --noEmit` | pass | TypeScript exit 0 |
| `npm run build` | pass | Next.js 16.2.6 webpack production build exit 0 |
| browser mobile smoke | pass | 390×844：灰色购物车可点击，弹窗列出电话、税号、账单地址、收货地址；无 console error |
| Vercel production | pending |  |

## 执行记录

- 创建：2026-07-20
- 批准：2026-07-20，老板要求开始执行并在完成后推送应用
- 开始：2026-07-20
- review：2026-07-20，业务契约、Next.js Server/Client 边界、前端体验审查通过
- verified：2026-07-20，本地质量门与移动端浏览器 smoke 通过
- released：pending
- closed：pending

## 结果

代码与本地验证已完成，等待提交、推送及 Vercel 生产发布验证。
