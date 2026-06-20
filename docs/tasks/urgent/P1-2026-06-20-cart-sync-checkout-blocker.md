# P1-2026-06-20-cart-sync-checkout-blocker

状态：closed

看板目录：urgent

优先级：P1

Task ID：TASK-20260620-03

风险等级：R2

自治等级：L2

## 老板原始目标

为什么可以点击结账却显示异常需要刷新。查找原因并修复所有相关逻辑以及闭环确保所有帐号不会出现相关问题。

## 目标

购物车同步失败时，客户不能继续进入或提交结账；页面必须明确提示同步失败，并提供重试同步入口。同时修复远端购物车保存 RPC 的 `sku_code` 歧义，避免 `/api/cart` 保存返回 502。

## 业务影响

避免客户在本地购物车与账号远端购物车不同步时继续下单，减少金额、库存、客户价和订单明细不一致导致的异常订单。

## 完成定义

`/carrello`、移动端底部结账条和 `/checkout` 都把远端购物车同步错误视为硬阻断；客户可点“重试同步”重新读取账号购物车，失败状态不会继续放行结账；`replace_current_customer_cart(jsonb)` 不再因 `sku_code` 字段歧义导致保存失败。

## 主责部门

订单运营部

## 协作部门

价格与客户部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、PartsPro 业务契约代理、前端体验代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 订单运营部 |
| Approver | 老板 |
| Consulted | PartsPro 业务契约代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：`/carrello`、`/checkout`
- API：`/api/cart`、checkout 预览和提交链路
- 数据表/RPC：`customer_cart_items`、`customer_cart_sync_state`
- 文档：本任务卡
- 外部系统：无

## 已知事实

- `CartSyncBridge` 已能识别远端购物车加载、保存和刷新失败，并把 `remoteStatus` 设为 `error`。
- 修复前 `/carrello` 只展示同步异常 banner，但 `checkoutDisabled` 和移动端结账条没有把 `remoteStatus=error` 当成硬阻断。
- 修复前 `/checkout` 只阻断远端购物车 loading，没有阻断远端购物车 error。
- 线上 Vercel 日志显示截图时间附近 `GET /api/cart` 为 200，随后 `PUT /api/cart` 为 502；数据库回滚复现确认原因是 `replace_current_customer_cart(jsonb)` 内部 `sku_code` 引用与 `returns table` 输出列冲突。
- 购物车同步 API 基于当前账号读写，属于所有账号共用路径，不需要为单个账号写特殊逻辑。

## 假设与未知项

- 本次不新增数据库字段或表。
- 本次新增并应用一条 RPC 修复 migration：`20260620183000_fix_customer_cart_rpc_ambiguous_sku`。
- 本次不改变购物车 API 的鉴权和远端表结构；前端修复同步失败闭环，数据库修复保存 RPC。
- 未登录账号仍按现有登录门禁处理。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 订单运营部 | 购物车页同步失败硬阻断 | 现有 `CartSyncBridge` | 同步失败时结账按钮不可用 |
| WP-02 | 前端体验代理 | 客户可理解的错误提示和重试按钮 | i18n 字典 | 中意文提示完整 |
| WP-03 | PartsPro 业务契约代理 | checkout 页二次阻断 | 现有结账预览/提交逻辑 | 直接打开 checkout 也不能绕过 |
| WP-04 | Supabase Migration 守门代理 | RPC 歧义修复 migration | 远端 Supabase 项目 | 回滚 smoke test 写入成功 |
| WP-05 | QA | 验证证据 | 代码完成 | 类型、lint、build 和 smoke test 完成 |

## 批准要求

- 是否需要老板批准：当前请求已授权修复
- 是否需要 Supabase migration 安全门：是，已用 MCP 应用并验证 `20260620183000_fix_customer_cart_rpc_ambiguous_sku`
- 是否需要 Vercel 发布门：否，本次不部署
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- `/carrello` 远端购物车同步失败时显示错误提示和“重试同步”按钮。
- `/carrello` 远端购物车同步失败时，桌面订单摘要和移动端底部结账按钮都不可进入 checkout。
- `/checkout` 远端购物车同步失败时显示错误提示和重试入口，不继续展示可提交状态。
- 重新同步时会清理旧实时订阅和 refresh timer，重新加载当前账号购物车。
- 客户可见文案不再要求刷新作为唯一处理方式。
- `replace_current_customer_cart(jsonb)` 能正常保存含 `3000000094419` 的购物车 payload，不再报 `42702 column reference "sku_code" is ambiguous`。

## 禁止事项

- 不允许同步失败时继续放行 checkout。
- 不新增表或字段，不绕过 migration 记录直接漂移远端函数。
- 不绕过当前账号购物车 API 或 RLS。
- 不覆盖与本任务无关的促销、售后、等级或库存改动。

## 验证命令

```bash
npx tsc --noEmit
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `partspro-fullstack-audit contract_scan.py` | passed | 只读扫描完成，用于确认购物车/订单契约范围 |
| `npx tsc --noEmit` | passed | 无 TypeScript 错误 |
| `git diff --check` | passed | 无 whitespace/error diff |
| `npm run lint` | passed | ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 生产构建通过 |
| `curl -I http://127.0.0.1:3000/carrello` | passed | 购物车页 200 OK |
| `curl -I http://127.0.0.1:3000/checkout` | passed | 结账页 200 OK |
| `curl -i http://127.0.0.1:3000/api/cart` | passed | 未登录账号返回 401 `LOGIN_REQUIRED` |
| Supabase migration list | passed | 远端已记录 `20260620183000 fix_customer_cart_rpc_ambiguous_sku` |
| Supabase rollback smoke test | passed | 同 SKU payload 通过 `replace_current_customer_cart(jsonb)` 返回 `3000000094419`，事务已 rollback |
| `curl -i https://www.partspro.app/api/cart` | passed | 未登录线上请求返回 401 `LOGIN_REQUIRED`，不是 5xx |
| `agent-browser --help` | unavailable | 当前环境没有安装 `agent-browser` CLI，已用 build、curl 和 dev server 日志替代自动浏览器验证 |

## 执行记录

- 创建：2026-06-20
- 批准：老板当前消息授权
- 开始：2026-06-20
- review：2026-06-20
- verified：2026-06-20
- released：不适用
- closed：2026-06-20

## 结果

已完成购物车同步失败的硬阻断和重试闭环：`/carrello` 桌面摘要、移动端底部结账条和 `/checkout` 都会把远端购物车同步失败视为不可结账状态；客户可点“重试同步”重新读取当前账号购物车。已应用数据库 migration 修复 `replace_current_customer_cart(jsonb)` 的 `sku_code` 歧义，远端购物车仍走现有 `/api/cart` 和账号级数据表。

残余风险：当前环境没有可用的 `agent-browser` 或 Playwright/Puppeteer，未做真实浏览器截图验证；已通过 TypeScript、lint、build、dev server 路由和 API smoke test 覆盖主要回归风险。
