# P1-2026-10-04-order-void-wallet-refund

状态：production_refund_complete / release_verified_pending_deploy
Task ID：TASK-20261004-01
风险等级：R3；自治等级：L2
主责部门：订单运营部；协作部门：仓库库存部、价格与客户部
工程守门代理：PartsPro 业务契约与权限独立审查；Next.js / 前端流程专项验收
RACI：主助手 Responsible；老板 Approver；独立审查代理 Consulted；老板 Informed。

## 老板原始目标与范围

“将这2单的商品作废 余额打到他的账户钱包里 。因为屏幕没用。 同时完善退货流程 让我们有权限的员工也可以操作退款”。

仅处理 PP-20260925164001-0025F6 与 PP-20260926103733-430BA0 的单件屏幕，每单实付 EUR 13，总计 EUR 26；客户、金额、历史退款以 PartsPro-V4 / yiuxrjqexlfjtxxrkqvi 的只读查询为准。
涉及订单/RMA 后台、`/api/admin/rma`、RMA action、钱包批准 API、repository、RMA DTO；数据为 orders/order_lines/order_events/rma_requests/wallet_refund_requests/customer_wallets/customer_wallet_transactions。

## 授权与禁止事项

- 老板本次原话已授权这两单商品作废和退款至原客户钱包；不扩大至其他订单或客户，不重复确认同一退款授权。
- 未提供退回收货、检测或可销售库存证据，不伪造 receipt/QC，不将商品回补可销售库存。
- 不改价格原始快照，不删除原订单明细或历史，不更改员工现有授权；申请退款与批准入钱包权限分别执行。
- 若需新 migration，必须完成 migration 安全门并单独取得本次 db push 批准；Vercel 发布按独立发布门处理。
- 保护仓库既有未提交修改，不输出秘密或完整个人信息。

## 验收标准与工作包

1. 精准核对两单同一客户、各 EUR 13、没有既有退款，独立审查实际操作计划。
2. 退款使用现有受控创建/批准函数与事务，防重复与超额，记录原因、操作来源和订单事件；写后钱包总额、交易、订单一致，库存不增加。
3. 修复员工 RMA 读取、收货/检测、明确退款金额与批准入钱包链路；API/SQL/DTO/UI 权限保持一致。
4. 执行相关行为/合同测试、lint、build 与手机/桌面目标交互验收；实际生产与测试数据证据分开。

## 验证命令与证据

`git diff --check`、本次定向 `node --test tests/<实际新增文件>.test.mjs`、`npm run test:storefront`、`npm run lint`、`npm run build`。

2026-10-04 已通过 MCP 只读核验目标项目名称/ref，确认两单各 EUR 13，税费/运费为 0、各交付 1，无既有 RMA/退款/信用流水；客户钱包尚未建立。
结果、独立审查与剩余限制随实际验证更新；本文件不证明发布或迁移完成。


## 已完成的实际业务操作

- PartsPro-V4 / yiuxrjqexlfjtxxrkqvi：两单在同一事务内通过已有钱包退款创建/批准函数各入账 EUR 13，合计 EUR 26；原客户退款后钱包余额 EUR 26。
- 两单均标记 cancelled 并作废隐藏；原支付 EUR 13、订单明细与交付数量保留用于历史审计。每单保留批准申请和唯一钱包 credit，避免重入。
- 独立写后查询确认两笔批准与两笔 credit、两条本次作废事件相符；本次无库存流水，库存没有增加。未伪造 RMA 收货、检测或退回实物。
- 操作采用老板本次明确授权，使用已核验 Owner 身份与 auth.uid 的事务上下文，审计记录标明执行方式和授权来源；没有使用 service role 绕过资金 RPC。

## 上线版本与验证边界

- 发布源码：`.codex-worktrees/employee-rma-refund-20261004`，分支 `codex/employee-rma-refund-20261004`。主目录含既有未提交及较早版本改动，不能整目录部署；本次以线上 c33a1ac / c344fadc 基线做最小移植。c344fadc 相对 c33a1ac 只有 roadmap 文档。
- 最终保留既有协商、分拆、收货向导、换货及库存流程；新增 RMA 内独立钱包批准确认入口。exact `wallet_refunds.approve` 与 `rma.refund` / `wallet_refunds.request` 分离，未给员工新授权。
- admin repository 入口核对 staff 身份与 exact `rma.read` / `orders.read`；已有 service-role 只读 hydration 保留，预览和所有写入继续使用用户 JWT RPC。QC 单独要求 exact `rma.manage` / `rma.inventory`，收货/库存权限 union 保留。
- 实际数据库 `requested` 映射为 RMA DTO 的 `pending`，并以精确 refund id + rma id + rma_return + EUR 关联核对金额。只有有钱包流水时显示 approved_amount；申请金额不冒充已入账金额。
- 退款金额须显式输入，API/UI 都验证 EUR 分币及原订单上限；批准确认显示客户、原订单和申请额，完成后提示实际入账额。
- 冻结版本通过 34 项定向 RMA/员工合同/API/helper 测试、6 项 storefront 测试、全量 lint、生产 build、git diff --check。新增员工测试实际执行 DTO、API、read gate 与 requested/ledger mapper；初始主目录的 16 项证据不替代本发布版本验证。
- `scripts/verify-rma-refund-ui.mjs` 用真实组件、当前源码 CSS、隔离 Chrome、模拟 API 验证桌面、390x844 手机与意大利文：空金额、千分位/超限、失败同键重试、取消/批准、实际 EUR 12.50 显示、只读/仓库/批准角色分离。无页面错误或横向溢出。证据：发布源码内 `outputs/rma/2026-10-04/verification.json` 及截图。
- 这些浏览器与 API 测试没有真实业务写入，不证明真实员工账号线上退款 E2E；实际两单生产退款通过单独 SQL 结果核验。没有 migration、生产 env 或员工权限更改。

## 发布与回退

目标：Vercel `parts-pro-v4` / `prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo`，team `team_AOJDnrjov0QDLqpvMyhwA1yc`。当前 partspro.app 已只读核验指向 `dpl_EE4NmwdYDoPeeN3vgVgFEcofRGYX`，作为代码回退目标。

先创建不切域名的生产候选、验证 READY 与匿名权限/API/资源，再 promote。代码回退不撤销已经授权且完成的钱包退款；如需资金补偿须由老板另行授权。
