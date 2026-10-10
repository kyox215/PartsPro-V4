# P1-2026-10-10-admin-panel-comprehensive-ux

状态：local_ready_for_owner_gate（本地候选完成，生产未执行）
Task ID：TASK-20261010-ADMIN-UX
风险等级：R3
自治等级：L2（本地实施和验证）

## 老板原始目标
“进行全面的修复与优化”，对应 docs/audits/2026-10-10-admin-panel-operation-ui-audit.md 的64项。

## 目标与完成定义
以运行源码832c53c/a32c8b9为基础，修复金额/客服误操作、布局、操作恢复、查询与范围、权限和中意UI；64项逐项给出实现及验证，不把计划算完成。主目录现有未提交候选不覆盖。

## 主责与协作
主责：平台发布部（后台工程）；协作：订单运营、价格客户、仓库采购、电商、文档审计。
RACI：主助手实施/整合；财务子助手负责财务闭环；子助手顺序专项复核业务契约与Next/UI；老板批准生产migration/发布。

## 工作包
1. 财务F-01至F-08：金额/日期、权限、失败恢复、分页、付款独立批次、原位纠正、页签。
2. 主助手：公共导航/客服安全；订单/账号/权限流程；商品/目录/导入/库存；eBay/REMAX/日志；统计口径。
3. 集成：定向合同和交互、全量lint/build、中意桌面/手机/短屏、独立专项审查；64项结果报告。

## 范围与所有权
工作树：本项目内 .codex-worktrees/admin-panel-comprehensive-20261010，分支codex/admin-panel-comprehensive-20261010。
财务子助手唯一写入：admin-finance-panel.tsx、api/admin/finance/**、新增财务输入helper与对应测试；不得编辑主repository或词典。
主助手唯一写入：其他后台组件/API/shared repository/词典/文档。需要共用helper先消息协调。

## 授权和禁止事项
当前授权：全面本地修复、必要测试、隔离模拟和文档。没有真实记账/消息发送/退款/库存/权限写入授权。
Supabase PartsPro-V4/yiuxrjqexlfjtxxrkqvi敏感。新增schema时使用CLI生成migration，完成list/dry-run/专项审查后本次db push须明确批准；Vercel发布独立批准。默认优先复用既有API/schema。
保留已上线售后协商/换货/员工功能；不能以降低校验、绕过权限或把错误当空数据来简化。

## 验收与命令
实际存在：git diff --check；node --test tests/<新增/相关>.test.mjs；npm run test:storefront；npm run test:product-import；npm run lint；npm run build。
使用真实组件/模拟API验证失败输入、会话隔离、已成功写入的读失败、64项影响流程；生产/物理设备证据独立标明。

## 进度与证据
2026-10-10开始。执行状态以docs/roadmap.md为权威；此任务卡记录范围和验收。全部完成后补结果。

## 本地交付结果

64项本地实现及逐项验证见 [修复与验证报告](../../audits/2026-10-10-admin-panel-repair-verification.md)。129后台测试、26商城/导入回归、18真实组件模拟交互、60页面/视口组合、全量lint/build与diff检查通过。实际编译Next的9个匿名API均403，后台页流式跳转登录。独立SQL/RLS与恢复流程专项静态GO。

新增migration 20261010204858_admin_support_atomic_reply.sql，PartsPro-V4/yiuxrjqexlfjtxxrkqvi已只读核对；无remote-only分歧，dry-run仅该文件。真实应用与发布均未执行，等待本次明确批准。测试、SQL fixture与真实服务边界详见报告，不以模拟验证代表生产。
