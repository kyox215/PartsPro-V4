# P1-2026-07-09-cart-sync-regression-guard

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260709-02

风险等级：R2

自治等级：L2

## 老板原始目标

检查所有相关逻辑确保不会出现类似的错误

## 目标

对购物车同步、购物车页、checkout 页和订单提交前校验做二次审计，补齐同类恢复路径，避免旧同步错误、PWA session 恢复中状态或写入失败继续卡死 checkout。

## 业务影响

购物车同步状态是下单链路的硬门禁。若不同页面对状态含义理解不一致，或远端写入失败后只能保留旧 error，客户会在账号和后端都正常时仍无法下单。

## 完成定义

统一 cart 远端同步状态判断；checkout 与 cart 页使用同一套 pending/error 语义；远端保存失败后优先重试保存当前本地 cart，不用远端旧 cart 覆盖客户刚修改的购物车；完成 lint/build 验证。

## 主责部门

订单运营部

## 协作部门

前端体验代理、PartsPro 业务契约代理、平台发布部、文档审计部

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
- 客户端同步：`CartSyncBridge`
- API：`/api/cart`、`/api/orders/preview`、`/api/orders`
- 数据表/RPC：`customer_cart_items`、`customer_cart_sync_state`、`replace_current_customer_cart(jsonb)`
- 文档：本任务卡

## 审计结论

- `/carrello` 已把 `loading` 和 `restoring` 都当作远端 cart 未完成，但 `/checkout` 只识别 `loading`，PWA session 恢复中存在绕过同一等待语义的风险。
- 远端读取成功后的 error 清理已在上一任务修复，但远端写入失败后仍只进入 `error`，没有复用自动恢复路径。
- 写入失败后的人工重试若直接重新读取远端 cart，可能用远端旧 cart 覆盖客户刚在本机改过的数量或删除动作。
- `/api/cart` 的状态分类保持合理：401/404 进入 local mode，其余写入失败继续作为 checkout blocker；本次无数据库 schema 改动。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | PartsPro 业务契约代理 | cart/checkout 状态矩阵 | fullstack audit | 找出页面状态语义差异 |
| WP-02 | 前端体验代理 | 统一状态 helper | `cart-sync-bridge.tsx` | cart/checkout 共用 pending/error 判断 |
| WP-03 | 订单运营部 | 写失败恢复路径 | `/api/cart` | 重试先保存本地未同步 cart |
| WP-04 | 平台发布部 | 验证 | lint/build | 无 TS/ESLint/build 回归 |

## 批准要求

- 是否需要老板批准：当前请求已授权检查并修复相关逻辑
- 是否需要 Supabase migration 安全门：否，本次无 schema 改动
- 是否需要 Vercel 发布门：如需上线，按 main 推送和生产部署流程执行
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- `/carrello` 和 `/checkout` 对 `loading`、`restoring`、`error` 使用同一套 cart sync 语义。
- checkout 在 Supabase session/cart 恢复中不会进入可提交状态。
- 远端 PUT/DELETE 失败后会自动触发有限重试。
- 若本地 cart 与最后成功远端快照不同，重试优先保存当前本地 cart，而不是先读取远端旧 cart。
- 成功保存或读取后 `remoteStatus` 回到 `ready`。

## 禁止事项

- 不放开真实 cart sync error 下的 checkout 硬阻断。
- 不用数据库手工修单个客户 cart 掩盖客户端状态机问题。
- 不触碰未跟踪 PWA 图标副本。

## 验证命令

```bash
python3 ~/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-contract-scan-cart-checkout.md --json /tmp/partspro-contract-scan-cart-checkout.json
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `partspro-fullstack-audit contract_scan.py` | passed | 只读合同扫描确认 cart/order 表、页面和 API 范围 |
| `git diff --check` | passed | 无 whitespace/error diff |
| `npm run lint` | passed | ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 production build 通过 |
| `npx tsc --noEmit` | passed | TypeScript noEmit 通过 |

## 执行记录

- 创建：2026-07-09
- 批准：老板当前消息授权
- 开始：2026-07-09
- verified：2026-07-09
- released：待确认是否推送
- closed：2026-07-09

## 结果

已完成购物车同步状态的防回归补强：`/carrello` 和 `/checkout` 统一使用 cart sync pending/error helper，checkout 现在会在 `restoring` 状态下继续等待远端账号 cart；远端保存失败后会自动触发有限重试，且当本地 cart 与最后成功远端快照不一致时，重试会先保存当前本地 cart，避免用远端旧 cart 覆盖客户刚修改的数量或删除动作。本次无 Supabase migration。
