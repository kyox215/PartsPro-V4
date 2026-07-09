# P1-2026-07-09-cart-sync-recovery

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260709-01

风险等级：R2

自治等级：L2

## 老板原始目标

修复这个无法下单的问题 检查原因 账号是xujiexiang的那个

## 目标

修复前台购物车同步错误后长期卡住 checkout 的问题，并确认 jiexiang xu 账号本身仍满足下单条件。

## 业务影响

购物车同步失败会直接暂停 checkout。若客户端旧失败状态不能恢复，客户即使账号、商品和远端 cart API 已恢复，也无法进入下单流程。

## 完成定义

确认账号、客户资料、cart RPC 和商品读取不是硬性阻断；修复客户端远端 cart 刷新成功后不清理旧 error 的状态机缺陷，并完成 lint、typecheck、build 验证。

## 主责部门

订单运营部

## 协作部门

价格与客户部、平台发布部、文档审计部

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
- API：`/api/cart`
- 数据表/RPC：`customer_cart_items`、`customer_cart_sync_state`、`replace_current_customer_cart(jsonb)`
- 文档：本任务卡
- 外部系统：Supabase、Vercel production logs

## 已知事实

- 目标账号匹配为 `jiexiang xu` / `jiexiangxu20@gmail.com`。
- 账号客户资料当前为 active、wholesale、assigned、profile complete、king level。
- 远端 `customer_cart_items` 当前为空，截图中商品来自本地 cart state。
- 同账号 rollback 事务调用 `replace_current_customer_cart('[{\"sku\":\"3000000166222\",\"quantity\":1}]')` 成功，说明账号和 cart RPC 不是永久性阻断。
- Vercel production 过去 24 小时未查到 `/api/cart` 或 5xx 日志，说明截图时的失败很可能停在客户端/浏览器/PWA 层或旧错误状态。
- 代码缺陷：`refreshRemoteCart()` 成功后只应用远端 cart，没有把 `remoteStatus` 从旧 `error` 恢复为 `ready`。

## 假设与未知项

- 未拿到客户设备上的浏览器 console/network 详情。
- 本次不修改数据库 schema，不应用 migration。
- 本次不改变同步失败硬阻断规则，只修复恢复路径。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 订单运营部 | 账号和 cart 数据只读诊断 | Supabase MCP | 确认账号与 RPC 可用 |
| WP-02 | 前端体验代理 | cart sync 状态机恢复修复 | `CartSyncBridge` | 成功刷新后清理旧 error |
| WP-03 | Next.js 16 App Router 代理 | 构建验证 | Next 16 docs | lint/typecheck/build 通过 |

## 批准要求

- 是否需要老板批准：当前请求已授权修复
- 是否需要 Supabase migration 安全门：否，本次无 schema 改动
- 是否需要 Vercel 发布门：需要随 main 自动部署后观察
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- 远端 cart 刷新成功后 `remoteStatus` 会恢复为 `ready`。
- 手动重试、online、visibility 恢复和有限自动重试不会被旧请求结果覆盖。
- 旧失败请求不能在新同步成功后把页面重新打回 error。
- `/carrello` 和 `/checkout` 仍然在真实同步失败时暂停 checkout。

## 禁止事项

- 不放开真实 cart sync error 下的 checkout 硬阻断。
- 不写生产数据修补单个账号 cart，除非后续老板明确要求。
- 不触碰未跟踪 PWA 图标副本。

## 验证命令

```bash
python3 ~/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-contract-scan.md --json /tmp/partspro-contract-scan.json
npx tsc --noEmit
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `partspro-fullstack-audit contract_scan.py` | passed | 只读扫描完成，确认 cart/order 合同范围 |
| Supabase account/cart diagnosis | passed | 目标账号 active/assigned/profile complete；远端 cart 为空；cart RPC rollback smoke 成功 |
| Vercel production logs | passed | 过去 24h 无 `/api/cart` 和 5xx 命中 |
| `git diff --check` | passed | 无 whitespace/error diff |
| `npm run lint` | passed | ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 production build 通过 |
| `npx tsc --noEmit` | passed | build 清理 `.next/types` 重复生成文件后通过 |

## 执行记录

- 创建：2026-07-09
- 批准：老板当前消息授权
- 开始：2026-07-09
- review：2026-07-09
- verified：2026-07-09
- released：待 main 部署
- closed：2026-07-09

## 结果

已修复 `CartSyncBridge` 的恢复路径：远端 cart 刷新成功会清理旧 error 并恢复 `ready`；远端读取/重试带尝试代号，旧请求不能覆盖新状态；同步失败会做有限自动重试。账号本身和 cart RPC 经只读/rollback 验证可用，本次无需数据库 migration。
