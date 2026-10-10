# P1-2026-10-10-admin-products-ux

状态：released。Task ID：TASK-20261010-PRODUCTS-UX。风险：R2；自治：L3，推送部署已由用户明确授权。

老板目标：检查后台商品管理设计、操作逻辑和页面 UI，提供详细优化建议并执行，完成后推送部署。

主责：商品目录部；协作：平台发布部。主助手实施；catalog_review 独立检查业务状态、批量 API 和发布门禁。RACI：R 主助手，A 用户既有发布授权，C catalog_review，I 用户。

范围：后台商品列表/编辑/媒体/库存弹层；商品 DELETE 的结果契约；前后台系列显示名称。复用现有商品 RPC，不更改 SQL/价格库存计算/RLS。详细建议见 `docs/audits/2026-10-10-admin-products-ux.md`；状态归入 `docs/roadmap.md`。

验收：lint/build/相关合同测试通过；中意桌面手机交互通过；精确源码提交已推送；Vercel生产候选源码哈希与 smoke 通过；独立发布 GO；生产域名解析到候选，并完成真实账号只读与公开路径复查。

批准与边界：本次无 migration，不需要 db push。目录完整候选、图片并发、跨请求库存幂等单独保留，不能借发布执行生产 DB 写入。禁止覆盖主目录用户改动、自动重放库存、无断言宣称真实写入验收。回滚至 `dpl_FZHgXPWj6fLzuHNw23yDHxQGcgJb`，不需要数据补偿。

验证命令：`git diff --check`；`npm run lint`；`npm run build`；`node --test tests/admin-bulk-hide-contract.test.mjs tests/storefront-i18n-contract.test.mjs tests/checkout-state-contract.test.mjs tests/partspro-product-import-core.test.mjs`。浏览器证据保存于 `outputs/admin-products/2026-10-10/`，生产写入不在本次 smoke 范围。


发布结果：源码e35da93，生产dpl_3uXTPRgAjbBTxxhMJoufPhsTdwDm。362源码hash、7候选/7生产HTTP smoke与独立promote GO已核对；生产staff手机主要只读操作和桌面布局/编辑打开已核对。桌面未保存退出的生产复查被浏览器自动化超时中断，临时输入清理等待用户；本地该行为四视口通过。数据库层目录/并发/幂等不属于本次已发布范围。详细证据见 outputs/admin-products/2026-10-10。
