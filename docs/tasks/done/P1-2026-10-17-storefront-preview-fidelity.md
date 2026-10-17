# P1-2026-10-17-storefront-preview-fidelity

Task ID：TASK-20261017-UI03；状态：complete；风险R3；自治L3。

目标：按已交付27张PNG高度还原全前台，纠正此前只接近配色、版式比例偏离的问题。用户已确认高度还原和配件主题首页，随后明确“logo也改过去”，因此以参考蓝底白P替换现有站点logo，取代上一条logo冻结要求。

主责：前端体验；协作/守门：Next、业务契约、平台发布。主代理实施公共商城与购买流程；单一协作代理仅写账户组件和account-ui.css，收尾独立复核。

工作区：.company-tmp/storefront-visual-match-20261017；分支codex/storefront-visual-match-20261017；base74cc6e6（已发布dpl_AeHQgnmVHqiPch8dUkwDvikvCcwg）。主目录既有改动不覆盖。

范围：header/home/catalog/product/cart/checkout/account/auth/professional/rma/help/overlays以及站点logo图标；仅展示与必要前台接线。禁止改后台面板、API/RPC/SQL、生产env、价格/库存/MOQ/预售/钱包/下单与恢复契约，禁止生产真实业务验收写入。

验收：1536×1024逐页设计板对照，390/360/768/320响应式与中意双语；本地实际组件夹具覆盖私有账户/非空购物车/checkout，夹具不部署；相关合同、lint/build、独立守门、上传hash与候选/正式smoke。按既有批准目标源码stage生产，验收后promote同一构建，保留74cc回退。状态只以docs/roadmap.md为权威。

命令：npm run lint；npm run test:storefront；npm run build；现有相关node --test tests/<具体合同文件>.test.mjs；git diff --check。不虚构E2E脚本。

本地结果：双层导航、配件主视觉/商品tabs/REMAX分区、目录横向卡/草稿筛选、账户白公司卡/蓝钱包/状态与订单、购买流程和认证页面排版、蓝P站点/PWA图标已完成。相关32合同测试通过；正式build和源码lint通过，verification本地演示构建文件排除于lint和上传。最终发布/域名核对待完成。

最终验收：c2e5525 / dpl_BGN6DBjWepiQRjU3svqkeFLx2DMV 已上线，两域名精确一致；32相关测试、lint/build、1084文件/451保护和452上传、候选/正式各12 HTTP及浏览器验收PASS。详细证据与旧submitted付款文案口径问题见 docs/audits/2026-10-17-storefront-reference-fidelity-release.md。无DB/env/业务写入。
