# P1-2026-09-13-rma-waiting-return-closure

状态：done

看板目录：done

优先级：P1

Task ID：TASK-20260913-02

风险等级：R3

自治等级：L3

## 老板原始目标

“这边以阻塞是什么帮我检查所有相关逻辑闭环并解决问题 然后推送并部署 确保售后流程正常”

## 目标

确认 `waiting_customer_return` 的真实含义，修复后台对正常等待状态的错误呈现，并验证客户寄回、仓库收货、质检、退款/换货、库存处置和关闭的安全闭环。

## 业务影响

后台当前把正常等待客户寄回显示为“已阻塞”并直接暴露内部状态码，容易让运营误判系统故障；若客户寄回入口、通知或仓库兜底动作不可用，已批准售后会长期停滞。

## 完成定义

- 线上目标单据状态和依赖通过脱敏只读查询确认。
- 正常外部等待与权限/数据异常明确分层，页面不再裸露内部 reason code。
- 客户一键寄回和仓库直接收货兜底均有可追溯的代码、权限与测试证据。
- RMA 状态机相关定向测试、lint、build 和发布 smoke 通过。
- 代码提交并推送到 `main`，对应 Vercel production deployment 为 READY。

## 主责部门

订单运营部

## 协作部门

仓库库存部、平台发布部

## 工程守门代理

PartsPro 业务契约代理、前端体验代理、Vercel 发布代理；如新增 migration，再加入 Supabase Migration 与 RLS/权限守门代理。

## RACI

| Role | Owner |
|---|---|
| Responsible | Codex 主线程 / 订单运营部 |
| Approver | 老板 |
| Consulted | PartsPro 业务契约、前端体验、仓库库存、平台发布 |
| Informed | 售后运营人员 |

## 涉及范围

- 页面：后台 RMA 工作台、客户 `/rma` 历史申请与寄回入口。
- API：`GET /api/rma`、`POST /api/rma/:requestId/shipped`、后台 RMA 列表/详情/动作接口。
- 数据表/RPC：`rma_requests`、`rma_request_events`、`notification_events`、`rma_mark_customer_shipped`、`admin_perform_rma_action_v3`。
- 文档：本任务卡。
- 外部系统：Supabase PartsPro-V4（只读核对）、GitHub、Vercel production。

## 已知事实

- 目标单据为 `approved`，`customer_shipped_at`、`received_at`、QC、商业结果和关闭字段均为空；它没有处于矛盾数据状态。
- 线上共有 2 条 `approved + customer_shipped_at is null` 的待寄回单，没有已声明寄回的 approved 单。
- 目标客户、提交者 active membership、订单/客户关系、批准通知和 customer shipped RPC grant 均存在。
- 当前服务端允许具备库存权限的员工在客户未声明寄回时执行受控 `mark_received` 兜底，但不把该动作作为推荐动作。
- 现有后台 UI 把所有没有推荐动作的情形统一渲染为“已阻塞/Bloccato”，并直接显示 `waiting_customer_return`。

## 假设与未知项

- 截图登录账号是否具备库存权限尚不能从截图确认；UI 必须严格按服务端 `availableActions` 展示兜底动作。
- 不使用真实客户/管理员账号写入生产业务数据；生产写动作 E2E 仍需受控测试账号与单据。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 主线程 | 线上状态、通知、权限与状态机脱敏审计 | 只读 Supabase | 目标等待原因和可推进路径已确认 |
| WP-02 | 前端体验/业务契约代理 | 等待/阻塞分层、本地化 reason、直接收货安全兜底及 UI 测试 | WP-01 | 定向测试与 lint 通过 |
| WP-03 | 主线程 | RMA 全链路回归、独立审查和发布候选验证 | WP-02 | RMA 测试、lint、build 通过 |
| WP-04 | 平台发布 | 提交、推送、Vercel production 与 smoke | WP-03 | 对应 commit 部署 READY |

## 批准要求

- 是否需要老板批准：本轮修复、推送、部署已由老板明确要求。
- 是否需要 Supabase migration 安全门：只有新增/修改 migration 时需要；真实 linked push 必须另行展示 dry-run 并取得本次明确批准。
- 是否需要 Vercel 发布门：需要。
- 是否需要 PartsPro 业务契约验收：需要。

## 验收标准

- `waiting_customer_return` 显示为正常等待，不显示“已阻塞”且不裸露内部代码。
- 真正的权限、缺字段、数量、QC、退款审批等阻塞以中意双语可理解文案呈现。
- 待寄回单只在服务端允许时展示“门店/仓库直接收到”兜底，并在写入前明确二次确认。
- 客户寄回成功后进入 receiving 投影并推荐收货；直接收货后进入 QC；后续商业与库存双轴完成后才能关闭。
- 不放宽现有权限、数量、幂等、QC、退款、库存和关闭守卫。

## 禁止事项

- 不为了消除“等待”而自动标记客户已寄出或仓库已收货。
- 不修改、补写或关闭截图中的生产售后单。
- 不把只读 smoke 或纯规则测试表述为真实生产交易 E2E。
- 未经 migration 安全门和本次明确批准，不写 linked Supabase schema/data。

## 验证命令

```bash
node --test tests/rma-admin-workflow.test.mjs tests/rma-admin-ui-contract.test.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/rma-rules.test.mjs tests/rma-upload-client.test.mjs tests/rma-notification-contract.test.mjs tests/notification-center-rma-ui-contract.test.mjs
npm run test:storefront
npm run lint
npm run build
git diff --check
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| 生产目标 RMA 脱敏只读状态核对 | passed | approved；未寄回、未收货、未质检、未处理、未关闭 |
| 生产客户/订单/通知/RPC 可达性核对 | passed | active customer/member、canonical order、批准通知、authenticated RPC grant 均存在 |
| 修改前 RMA 定向测试 | passed | 87/87；同时复现 UI 把 expected wait 归入 blockedReason 的既有契约 |
| RMA 全链路合同测试 | passed | 113/113；覆盖等待语义、直接收货二次确认、状态守卫、通知 outbox、批量 drain、幂等和退款通知 |
| `npm run test:storefront` | passed | 6/6 |
| `git diff --check` | passed | 无空白或补丁格式错误 |
| `npm run lint` | passed | 全量 ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 production build、TypeScript 和静态页面生成通过 |
| migration 边界核对 | passed | 本任务未新增或修改 `supabase/migrations/*.sql`，无需也未执行 linked db push |
| PartsPro 业务契约独立审查 | passed | 最终复核无阻塞问题；浏览器 push 明确保持 best-effort，不影响数据库内通知和业务状态提交 |
| Vercel production deployment | passed | commit `ae532874a1cf9aa1ee74c726572d1e5d04bd7812`；deployment `dpl_J9Uorqmp7hjw1sYJ7o3AqCbfV1yi` 为 READY，custom aliases 已绑定 |
| Vercel production smoke | passed | `/` 200 且包含目标 deployment marker；通知配置 200/configured；客户和后台 RMA API 匿名访问均 401；RMA 深链匿名访问进入 `/login` 并保留 `/rma` 返回路径 |
| Vercel runtime errors | passed | 目标 RMA、通知及页面路由最近 15 分钟无 runtime error cluster |

## 执行记录

- 创建：2026-09-13
- 批准：2026-09-13，老板明确要求修复、推送并部署。
- 开始：2026-09-13
- review：2026-09-13，业务契约独立审查通过，无阻塞问题。
- verified：2026-09-13，RMA 113/113、storefront 6/6、全量 lint/build、diff check 通过。
- released：2026-09-13，`ae53287` 已推送 `main`，对应 Vercel production deployment READY。
- closed：2026-09-13，生产只读 smoke 与运行时错误检查通过；未修改真实售后业务数据。

## 结果

已完成并发布。截图状态确认为正常等待客户动作，不是数据库损坏；后台现按“等待客户寄回”呈现，受权员工可在实物完整到达后经二次确认登记直接收货。客户提交、审批、寄出、收货、质检、退款/换货、库存处置和关闭各阶段的数据库内通知与浏览器 push 分发路径已补齐；push 未订阅或投递失败不会回滚已提交的业务动作。当前截图客户没有有效浏览器 push 订阅，仍会收到数据库内通知；启用浏览器通知后才具备 push 投递条件。生产部署、匿名权限边界、RMA 深链和相关运行时错误检查均通过，且未写入真实售后业务数据。
