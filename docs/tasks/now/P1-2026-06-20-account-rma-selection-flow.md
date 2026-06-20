# P1-2026-06-20-account-rma-selection-flow

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260620-01

风险等级：R2

自治等级：L2

## 老板原始目标

这边个人中心的售后帮我优化下操作逻辑，尽量是选项而不是输入。比如选择订单 然后选择商品 这样的去操作。帮我规划完善逻辑以及闭环 并完善

## 目标

把个人中心售后/RMA 从手填订单号、订单行 ID 和 SKU，改成“选择订单 -> 选择商品 -> 选择原因/数量/处理方式 -> 提交后追踪状态”的闭环。

## 业务影响

减少客户填错订单、SKU 和订单行 ID 的概率，让 RMA 申请直接绑定真实订单行，后台后续检测、换货、退款和状态追踪更可靠。

## 完成定义

客户能从个人中心售后区进入 RMA，RMA 页面能读取当前账号可售后的订单与订单行，提交 API 会在服务端再次校验订单行归属、剩余可申请数量和 RMA 载荷。

## 主责部门

订单运营部

## 协作部门

仓库库存部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、Supabase RLS/权限代理、PartsPro 业务契约代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 订单运营部 |
| Approver | 老板 |
| Consulted | PartsPro 业务契约代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：`/account`、`/rma`
- API：`GET /api/rma`、`POST /api/rma`
- 数据表/RPC：`orders`、`order_lines`、`rma_requests`
- 文档：本任务卡
- 外部系统：无

## 已知事实

- `rma_requests` 已有 `order_line_id`、`sku_code`、`order_no`、`quantity`、`problem_type`、`requested_resolution` 等字段。
- 现有数据库 trigger/policy 会要求 RMA 绑定真实订单行，并校验订单行属于当前账号或当前客户。
- 当前页面已改为客户选择订单和订单商品，不再要求客户手动输入订单号、订单行 ID 和 SKU。

## 假设与未知项

- 本次不新增文件上传存储，只保留本地选择提示。
- 本次不改数据库 schema，不自动应用 migration。
- 已发货、已完成、已送达订单优先视为可发起 RMA 的订单。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 订单运营部 | 选择式 RMA 流程设计 | 现有订单/RMA表 | 订单、商品、原因、数量、状态闭环明确 |
| WP-02 | 工程守门代理 | API 与 repository 校验 | 现有 Supabase RLS | 服务端不信任前端手填订单/SKU |
| WP-03 | 前端体验代理 | 手机端可操作表单 | API 输出 | 客户无需手填订单行/SKU |
| WP-04 | QA | 验证证据 | 代码完成 | lint/build 或失败原因已记录 |

## 批准要求

- 是否需要老板批准：当前请求已授权优化和完善
- 是否需要 Supabase migration 安全门：否，本次不新增/修改 migration
- 是否需要 Vercel 发布门：否，本次不部署
- 是否需要 PartsPro 业务契约验收：需要

## 验收标准

- RMA 页面加载当前账号可申请的订单选项。
- 选择订单后只能选择该订单内还有剩余 RMA 数量的商品。
- 数量使用选项选择，且不能超过剩余可申请数量。
- 提交 API 根据订单行反推订单号、SKU 和商品名，并校验当前账号归属。
- 个人中心售后区能从最近订单发起售后，并继续展示最近 RMA 状态。
- 选完售后订单后的页面使用订单摘要、商品卡、问题选项、检测状态选项和提交摘要，文本输入只作为补充说明。

## 禁止事项

- 不要求客户手填订单行 ID 或 SKU。
- 不新增生产数据库 migration。
- 不绕过 RLS 或在浏览器暴露 service role key。
- 不覆盖其他任务的未提交促销等级改动。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | passed | 无 TypeScript 错误 |
| `git diff --check` | passed | 无 whitespace/error diff |
| `npm run lint` | passed | ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 生产构建通过 |
| `curl -I http://127.0.0.1:3000/rma` | passed | 未登录时 307 到 `/login?next=/rma` |
| `curl -I http://127.0.0.1:3000/account` | passed | 未登录时 307 到 `/login?next=/account` |
| `curl -i http://127.0.0.1:3000/api/rma` | passed | 未登录时 401 `LOGIN_REQUIRED` |

## 二次优化记录：售后选择向导

- 日期：2026-06-20
- 触发：老板要求“选完售后订单后的页面也要改下，还有新建售后的页面，都尽量选择而不是填写”。
- 输出：`/rma` 改成“选择订单 -> 选择商品/数量 -> 选择问题/症状 -> 选择检测和损伤状态 -> 准备凭证 -> 提交摘要”的手机端向导。
- 输出：个人中心售后区改为“新建售后申请”主入口，并展示更多可直接选择的最近订单。
- 数据策略：不新增 migration，前端把选项自动整理到现有 `description` 字段，`POST /api/rma` 仍由 `orderLineId` 反查订单号、SKU 和商品名。
- 验证：`npx tsc --noEmit`、`git diff --check`、`npm run lint`、`npm run build` 均通过。

## 执行记录

- 创建：2026-06-20
- 批准：老板当前消息授权
- 开始：2026-06-20
- review：2026-06-20
- verified：2026-06-20
- released：不适用
- closed：2026-06-20

## 结果

已完成个人中心售后入口、RMA 选择式提交页、`GET /api/rma` 订单选项输出、`POST /api/rma` 服务端订单行校验和剩余数量校验。未新增数据库 migration，文件上传仍为本地选择提示。残余风险：多账号共享同一客户时，现有 RLS 读取策略主要按 `rma_requests.user_id` 读取，跨账号累计 RMA 数量仍依赖后续数据库级增强。
