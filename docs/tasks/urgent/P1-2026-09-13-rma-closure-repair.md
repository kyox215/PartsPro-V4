# P1-2026-09-13-rma-closure-repair

状态：in_progress

看板目录：urgent

优先级：P1

Task ID：TASK-20260913-01

风险等级：R4

自治等级：L2

## 老板原始目标

检查并复现客户账号售后流程中无法闭环的错误，修复后推送并部署。

## 目标

恢复客户 RMA 图片提交、失败恢复、账号权限、退款/换货、库存处置与最终关单的完整闭环。

## 业务影响

当前客户图片票据无法创建；部分恢复路径、钱包退款和拒绝后重新申请会卡死，且库存流水存在客户可见的内部字段旁路。

## 完成定义

代码与 migration 覆盖已复现缺陷，定向测试、lint、build、linked dry-run 和独立审查通过；获批后应用 migration、推送 main、完成生产部署与最小 smoke。

## 主责部门

订单运营部

## 协作部门

仓库库存部、价格与客户部、平台发布部

## 工程守门代理

PartsPro 业务契约代理、Supabase Migration 守门代理、Supabase RLS/权限代理、Next.js 16 App Router 代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 主线程工程代理 |
| Approver | 老板（生产 migration） |
| Consulted | RMA 独立审查代理 |
| Informed | 订单、仓库与客服运营 |

## 涉及范围

- 页面：`/rma`
- API：`/api/rma/drafts/**`、`/api/rma/submit`、`/api/admin/rma/**`
- 数据表/RPC：`rma_drafts`、`rma_attachments`、`rma_requests`、`wallet_refund_requests`、`stock_movements` 及 RMA RPC/trigger
- 文档：本任务卡
- 外部系统：Supabase PartsPro-V4、Vercel PartsPro 生产项目、GitHub main

## 已知事实

- 生产路径 CHECK 不接受 RPC 生成的普通 `.jpg`，所以票据 INSERT 必然回滚。
- 验证成功的附件不能通过单票取消，但客户端显式重启要求其取消成功。
- 退款审批先写钱包 credit，随后 trigger 再按包含该 credit 的余额校验，造成重复扣减。
- 已提交 draft 的幂等重放早于当前会员资格复核。
- 未收货 rejected 关单后会重新占用订单行退货额度。
- `stock_movements` 现网 SELECT policy 会向订单客户暴露包含供应商/库位/批次的 RMA 流水全列。

## 假设与未知项

- 生产写入 E2E 需在 migration 获批后使用受控测试数据执行；当前只做只读生产核对。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 主线程 | 根因复现与生产只读核对 | 无 | 缺陷均有代码/数据库证据 |
| WP-02 | 主线程 | migration、服务端清理与权限修复 | WP-01 | SQL/路由定向测试通过 |
| WP-03 | 前端体验代理 | 重启恢复与本地化错误提示 | WP-01 | 客户端状态测试与 lint 通过 |
| WP-04 | 主线程 + 守门审查 | build、dry-run、发布 | WP-02/03、老板批准 | 生产 smoke 通过 |

## 批准要求

- 是否需要老板批准：生产 `supabase db push --linked` 前需要本次明确批准。
- 是否需要 Supabase migration 安全门：是。
- 是否需要 Vercel 发布门：是；用户已要求部署，但仍须使用已验证提交。
- 是否需要 PartsPro 业务契约验收：是。

## 验收标准

- 正常图片路径可创建票据；非法路径仍被拒绝。
- 显式重启可原子放弃 open draft 与未提交附件，失败可安全重试；旧草稿不会耗尽额度。
- 全额/大额 RMA 钱包退款不被本次 credit 重复扣减，历史退款上限仍生效。
- 会员撤销或客户停用后，提交重放失败关闭。
- rejected → close 后同一订单行仍可按真实剩余数量重新申请。
- 客户不能通过 Data API 读取内部库存流水。
- 退款/换货与库存处置完成后才能 close，既有互斥与幂等约束保持。

## 禁止事项

- 未经本次明确批准不得应用 linked production migration。
- 不直接修改生产业务数据，不输出客户隐私或密钥。
- 不从原始脏工作树构建或部署。

## 验证命令

```bash
node --test tests/rma-upload-client.test.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/rma-admin-workflow.test.mjs tests/rma-admin-ui-contract.test.mjs tests/rma-repository-scope.test.mjs
npm run lint -- src/app/api/rma src/components/partspro/rma-page.tsx src/lib/partspro-rma-simple-flow.ts src/lib/partspro-rma-upload-client.mjs
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
git diff --check
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 8 个 RMA 定向测试文件 | pass | 91/91；覆盖图片票据、重启恢复、幂等重放、拒绝关单数量、退款和仓库关单契约 |
| storefront / i18n 定向测试 | pass | 6/6 |
| `npm run lint` | pass | 完整 lint 通过 |
| `npm run build` | pass | Next.js 16.2.6 编译、TypeScript 与 18 个页面构建通过 |
| `git diff --check` | pass | 无空白或补丁格式错误 |
| 生产只读 SQL | pass | 路径 regex=false、0 attachment、4 个过期 open draft、退款顺序与 ACL 均已核实 |
| 线上 schema 隔离重放 | pass | 最终 migration 在 schema-only 生产基线上单事务执行成功；无业务数据导入或线上写入 |
| 迁移后定义断言 | pass | 10/10：路径、当前访问门、数量谓词、RPC ACL、草稿锁/GC 重试、钱包精确交易、库存流水 RLS |
| GC/提交并发验证 | pass | 提交持锁时 GC 跳过；GC 持锁时提交等待/超时；清理失败可重试，ack 后才删除数据库票据 |
| 独立 Migration/RLS/业务契约审查 | pass | 无阻塞项；private 实现、public wrapper、放弃/GC/ack、库存 policy 与退款上限均符合预期 |
| `supabase migration list --linked` | pass | 本地/远端历史一致，无 remote-only divergence；仅本次 migration 处于 local-only |
| `supabase db push --linked --dry-run` | pass | 只会应用 `20260913185143_repair_rma_end_to_end_closure.sql`，不夹带旧 pending migration |
| `supabase db push --linked` | pass | 老板明确批准后已应用；远端历史已记录 `20260913185143` 且再次完全对齐 |
| 生产迁移后只读断言 | pass | 10/10；实际线上约束、wrapper 顺序、private ACL、GC/ack、钱包校验和库存 policy 均符合候选定义 |
| Supabase security/performance advisors | pass with existing advisories | 未发现本次 migration 的阻塞项；RMA RPC-only 表和受保护 customer RPC 的通用提示已复核，索引提示为既有性能债务 |

## 执行记录

- 创建：2026-09-13
- 批准：2026-09-13 老板明确批准本次 `supabase db push --linked`
- 开始：2026-09-13
- review：独立 RMA 守门审查已完成首轮
- verified：本地、线上 schema 隔离重放、linked 核对、生产应用后断言与 advisors 均已完成
- released：待完成
- closed：待完成

## 结果

待实现、验证与发布后补充。
