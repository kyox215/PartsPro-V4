# P1-2026-10-17-storefront-local-refresh

状态：done
Task ID：TASK-20261017-UI05
风险：R3（跨前台会话/报价保护与生产发布）；自治：L3（老板已批准具体计划并授权上线）。
主责：平台发布部；协作：订单运营、价格与客户；R主执行者、A老板、C独立业务契约/前端/发布守门、I老板。

目标：取消前台整页等待，同账户后台刷新保留导航、商品和草稿，身份改变仍隔离私密数据与报价。
范围：首页/目录/商品/购物车/结算/账户/售后/登录及申请加载展示、前台刷新调度与相关回归。
禁止：API/数据库/迁移/env/后台/依赖变更，覆盖根工作树其他改动，真实资料/交易/消息写入。无新migration依赖。
基线：正式FU4/f89a515已只读确认，隔离源4d9b2f2。回退dpl_FU4dTyHQ8MxxtxPsMKTztGYqR64N。
实现：300ms事件合并，30s同账户focus去重，15s有界失败；按身份/代客scope隔离，报价过期和identity立即失效；目录每批50/并发2并保留已加载数量；局部120ms提示。根源PricingSessionBoundary hidden/remount移除。
所有权：主执行者调度/公共页/目录/账户/加载样式；commerce_logic_review限定cart-page.tsx和checkout-client.tsx、commerce-refresh-ui测试，不递归分派。后续独立只读发布门。
验收：慢网/断网/超时、焦点事件风暴、报价到期、换账户/代客、筛选和分页竞态、表单草稿、ZH/IT/1536/390。测试业务写仅mock。
命令：git diff --check；npm run test:storefront；node --test tests/storefront-refresh-state.test.mjs tests/commerce-refresh-ui.test.mjs tests/performance-behavior.test.mjs tests/account-pricing-policy.test.mjs tests/storefront-commerce-interactions.test.mjs tests/cart-tools.test.mjs tests/checkout-cart-snapshot.test.mjs；npm run lint；npm run build。
发布门：源码/保护文件/上传哈希/精确SHA，远端build候选和正式只读HTTP/浏览器，独立PROMOTE_GO后同构建推广，正式alias及短时error核对。
证据：隔离候选verification/；当前权威状态仅docs/roadmap.md。

验收：运行a1073b8/源码fp a39383d3，B8同构建经独立PROMOTE_GO正式上线；6+51测试/lint/build、候选和正式各12HTTP、双语/1536/390/异常夹具通过，短时error/fatal0。回退FU4/f89保留。完整结果见docs/audits/2026-10-17-storefront-local-refresh-release.md；主目录源码保留，未合并main。
