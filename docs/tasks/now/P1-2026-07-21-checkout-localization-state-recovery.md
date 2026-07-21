# P1-2026-07-21-checkout-localization-state-recovery

状态：verified

看板目录：now

优先级：P1

Task ID：TASK-20260721-02

风险等级：R2

自治等级：L3

## 老板原始目标

修复意大利语首页及 checkout 中仍显示中文的等待、刷新、购物车同步和订单校验提示；检查全部相关逻辑，完成后部署。

## 目标

让商城购物车与 checkout 的全部加载、同步、校验、错误和提交状态严格遵循账号语言，并让所有等待状态在有限时间内结束。

## 业务影响

修复意大利客户在下单流程中看到中文的问题，并避免购物车恢复或订单预览长期卡住导致无法下单。

## 完成定义

- checkout/cart 相关翻译键在 `it-IT` 和 `zh-CN` 中成对完整。
- 意大利语状态文案不含中文或中意混排 fallback。
- cart loading/restoring 与订单 preview 请求在有限时间内进入 ready/local/error。
- 自动测试、lint、typecheck、build、移动端浏览器 smoke 通过。
- 生产部署 READY，线上关键页面通过 smoke，错误日志无本次回归。

## 主责部门

订单运营部

## 协作部门

前端体验代理、平台发布部

## 工程守门代理

PartsPro 业务契约代理、Next.js 16 App Router 代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | Codex |
| Approver | 鹤祥 |
| Consulted | PartsPro 业务契约代理、前端体验代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：`/carrello`、`/checkout`、移动端固定订单栏
- API：`/api/cart`、`/api/orders/preview`（仅调用时序与超时，不改服务端业务契约）
- 数据表/RPC：只读核对 `customer_cart_items`、`customer_cart_sync_state`；不改 schema
- 文档：本任务卡
- 外部系统：Vercel production

## 已知事实

- storefront 默认语言和账号语言优先级正确。
- checkout/cart 相关代码存在 28 个字典缺失键。
- `tx()` 缺键时会回退到组件内中文或中意混合文案。
- cart restoring、cart fetch 和 order preview fetch 存在无截止时间路径。

## 假设与未知项

- 截图中的等待可能是正常短暂恢复，也可能命中永久 restoring；实施按有界恢复处理。
- 线上实际请求延迟需部署后结合 smoke/log 再确认。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 前端体验代理 | 双语字典与纯语言 fallback | 现有 i18n | 相关键成对完整 |
| WP-02 | PartsPro 业务契约代理 | cart 恢复 deadline 与请求超时 | CartSyncBridge | 所有 pending 有终态 |
| WP-03 | Codex | preview 时序、超时和统一状态 | WP-02 语义 | remote ready/local 后才 preview |
| WP-04 | Next.js 守门代理 | 翻译契约回归测试 | WP-01 | 缺键自动失败 |
| WP-05 | Codex | 全量验证与生产部署 | WP-01 至 WP-04 | READY + smoke 通过 |

## 批准要求

- 是否需要老板批准：已批准实施和部署
- 是否需要 Supabase migration 安全门：不需要；本任务不改 migration/schema
- 是否需要 Vercel 发布门：需要
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- `it-IT` 的 checkout/cart 客户可见静态文案无汉字。
- `zh-CN` 不因缺键回退到意大利语。
- loading/restoring/preview 在 deadline 内进入 ready/local/error。
- pending/error 时不允许提交；恢复后可继续订单预览。
- 同步错误和超时均提供本地化重试操作。
- 服务端客户、价格、库存、MOQ 和总额复核保持不变。

## 禁止事项

- 不修改 Supabase schema、RLS 或订单写入 RPC。
- 不用旧远端购物车静默覆盖客户较新的本地购物车。
- 不触碰首页、后台商品和其他未提交改动。
- 不用部署掩盖未通过的 lint/build。

## 验证命令

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm run build
node --test tests/partspro-storefront-i18n.test.mjs
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无空白错误 |
| `npm run lint` | pass | 0 error；仅 `.codex-tmp` 既有 1 条 warning |
| `npx tsc --noEmit` | pass | TypeScript 检查通过 |
| `npm run build` | pass | Next.js 16.2.6 production build 通过 |
| `npm run test:storefront` | pass | 6/6：字典对称、缺键、汉字泄漏、cart/preview deadline 与状态优先级 |
| mobile browser smoke | pass | 未登录 `/` 与 `/checkout` 均为 `lang=it-IT`；除语言按钮“中”外无中文；17 秒后无无限等待；console 无 error/warn |
| production deployment | pending |  |

## 执行记录

- 创建：2026-07-21
- 批准：2026-07-21 老板确认修复并部署
- 开始：2026-07-21
- review：2026-07-21 已完成 i18n、cart/checkout 状态机与业务提交守门复核
- verified：2026-07-21 自动测试、lint、typecheck、build、浏览器 smoke 通过
- released：
- closed：

## 结果

代码与本地验证已完成，等待生产发布与线上 smoke。
