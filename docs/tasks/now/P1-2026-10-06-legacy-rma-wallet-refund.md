# P1-2026-10-06-legacy-rma-wallet-refund

状态：in_progress；Task ID：TASK-20261006-01；风险 R3；自治 L2。
当前进度：两笔真实退款及关闭已完成；通用流程候选已验证，等待本次 db push 明确批准，未应用新 migration、未部署新界面。
主责：订单运营部；协作：价格与客户部、仓库库存部、平台发布部。
RACI：主助手 Responsible，老板 Approver，独立资金/权限/迁移/发布审查 Consulted。

## 目标与授权

老板要求截图两条售后商品退至原客户钱包，解释为什么没有批准钱包退款按钮，提供操作截图；没有入口则修复闭环。

仅两条：PP-20260803110230-D3DDD9 / SKU 3000000194072（1件 EUR 6.50）和 PP-20260812152916-53B7E4 / SKU 3667075265009（1件 EUR 14.50）。第二张整订单 EUR 51.50，不退其它商品。两条均属于原客户，合计 EUR 21，无既有退款/credit，原钱包尚未建立。与 10月4日已处理的两单不同，不重复此前 EUR 26。

真实状态：已收货且数量/质检完整，原诉求 replacement，空历史价格快照，无现有商业结果/替换订单/钱包申请；库存已各自 restock / scrap 且数量1，不重做库存、不编造客户同意。

## 范围与安全边界

- PartsPro-V4 / yiuxrjqexlfjtxxrkqvi；RMA、原订单行、价格证据、钱包申请/交易、售后事件；前后端权限及操作指引。
- 用户原话已授权两件商品入原客户钱包；单事务精准补空原单价格依据、记录 Owner 退款方向、既有核价/申请/批准/close，逐笔断言 EUR 6.50 + 14.50 和钱包净增 EUR 21。审批金额偏差或库存/收货/质检/客户确认事实改变则回滚。
- Owner身份/权限、同客户与精确原订单行、原价、实付、无历史退款、触发器启用、实际ledger及幂等完成分支需独立审查。不能仅看RPC成功。
- 不改员工授权、不降低金额或库存保护、不伪造客户确认、不过度退款/重复钱包credit、不重做已完成库存。
- 若通用闭环需要新 migration，先完整本地验证/linked只读/dry-run/独立 Migration/RLS审查；本次 db push 必须另行明确批准。Vercel部署独立执行，不能发布依赖未应用schema的代码。

## 验收与验证

实际两笔批准、唯一credit、净增EUR21、RMA可闭环且原库存处置保持。UI具体解释原诉求/历史核价/尚未创建退款申请的门槛，具备已分配权限的员工有正确下一步。手机操作截图必须区分真实线上与演示接口，截图与点击验证分别留证。

复用已核验线上源 `.codex-worktrees/employee-rma-refund-20261004`，不是含其它未提交改动的主目录。源码变更后按现有脚本/定向RMA测试、lint、build、手机交互及必要迁移安全门验证。结果随实际执行补齐，不以模拟结果替代真实资金核验。

## 已完成结果与候选

- 精准事务已执行，事后独立只读核验：Dock EUR6.50 和 A34屏幕 EUR14.50；两个请求 approved，各一笔唯一 credit，钱包 EUR21，两条 RMA closed。原 restock/scrap 数量均1，新增库存流水0；原收货/QC及客户确认字段保持。
- 不再执行该两笔入账。原整订单和其余行保留；10月4日 EUR26 是不同订单，不能重退。
- 新入口固定显示“客户钱包退款”：准备并核价→创建申请→批准入账。准备需要售后管理＋钱包批准＋退款申请权限，原因与稳定key必填；原单关联、实付、价格快照冲突、协商、QC、库存数量和既有商业处理均失败关闭。准备函数不动钱包/库存、不伪造客户确认。
- 新 migration：`20261006002331_prepare_legacy_rma_wallet_refund.sql`，新增 `admin_prepare_rma_wallet_refund_v1`；无批量回填。最终 migration list 无 remote-only，最终 dry-run 只包含此 migration。独立 Migration/RLS/业务审查 GO；GO不代替生产批准。
- 最终全量 lint/build、36项定向合同测试、6项storefront、TypeScript通过；隔离 PostgreSQL17 应用115条migration，旧V4及新准备/权限/价格冲突/回滚断言全部通过，原退款申请/批准并发测试仅1笔credit。
- SQL复现：`RMA_V4_FIXTURE=tests/rma-v4-database-integration.sql RMA_V4_EXTRA_FIXTURE=tests/rma-wallet-preparation-integration.sql node scripts/rma-v4-db-test.mjs partspro-rma-v4-test-20261006`。专用容器network none，仅匿名volume，不连接linked环境。
- 手机390×844真实React组件＋本地模拟接口，准备/金额空值及超上限与多小数拒绝/申请/待批准/取消确认/模拟批准/关闭、只读及批准员工分离通过；无横向溢出，浏览器error/warn空。截图为演示，不证明真实员工线上E2E。线上浏览器仍停在登录页；不读取或注入登录凭据。
- 证据：主目录 `outputs/rma/2026-10-06/`；候选源码在既有项目内worktree。暂停只限迁移及依赖它的新界面发布，真实退款已完成。
- 回退：保持既有线上版本即可停用新入口；如已应用函数，先回退依赖它的代码，再在后续经批准迁移中撤回函数。代码回退不会撤销已批准EUR21；本任务不发起反向扣款。
