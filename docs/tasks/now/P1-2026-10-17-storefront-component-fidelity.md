# P1-2026-10-17-storefront-component-fidelity

状态：in_progress
优先级：P1
Task ID：TASK-20261017-UI04
风险等级：R3（跨模块前台 UI 与生产发布）
自治等级：L3（老板已明确授权实现、推送和上线）

## 目标
逐页核对原始 Image2 设计板，修正语言切换及全站组件、布局和排版差异；继续上线验收。

## 业务影响与范围
前台首页、目录、商品、购物车、结算、账户、登录、专业客户申请及通知/图片弹层。只重组现有展示和交互，不修改 API、后台、数据库、迁移、价格计算或订单提交协议。

## 主责与 RACI
主责部门：平台发布部；协作：价格与客户部、订单运营部；工程守门：前端体验、Next.js、业务契约、Vercel 发布。
R：主执行者；A：老板（本会话既有明确授权）；C：独立 release_guard；I：老板。

## 已知事实与工作包
- 当前正式版：c2e5525，deployment dpl_BGN6DBjWepiQRjU3svqkeFLx2DMV；本次回滚目标同此。
- 隔离候选：.company-tmp/storefront-fidelity-detail-20261017，基线5cc308f（c2后的文档提交）。canonical root未提交源代码不纳入发布。
- 参考：outputs/storefront-redesign/2026-10-17/images/ 的27张原始PNG。
- WP1：共享顶部、语言、目录树、首页、页脚与客服图标。
- WP2：购物车列布局、结算三组资料及摘要确认；全部真实校验/锁定保留。
- WP3：账户公司地址工作区/资料页签、图片图库弹层、通知外观；admin默认隔离。
- WP4：登录/申请分组、中文/意大利语与手机/桌面视觉验证。
- WP5：独立复核、精确提交部署、别名核对与线上只读smoke。

## 批准与禁止事项
老板已授权本项目GitHub推送及Vercel上线，无需重复确认。部署与migration分离，本次不依赖新schema，不执行db push、不修改生产env、不创建真实订单/资料修改/通知推送、不覆盖canonical root其他改动。

## 验收与验证命令
- 用户指出的语言控件还原为全名地球下拉，手机直接可达，实际cookie切换保留。
- 1536/768/390/320视口、IT/ZH，无横向溢出；使用真实组件的合成fixture明确标记，线上业务只读。
- git diff --check
- npm run lint -- --ignore-pattern 'verification/**'
- npm run build
- npm run test:storefront
- node --test tests/account-pricing-policy.test.mjs tests/storefront-commerce-interactions.test.mjs tests/remax-commerce-contract.test.mjs tests/cart-tools.test.mjs tests/checkout-cart-snapshot.test.mjs
- 精确deployment SHA、上传文件哈希、HTTP及浏览器证据与独立发布门。

## 执行记录
实现中；验证证据放隔离候选 verification/。最终线上状态只记 docs/roadmap.md。
