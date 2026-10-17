# 前台局部加载与后台刷新发布验收

TASK-20261017-UI05，2026-10-17，已上线 https://www.partspro.app/ 。

## 发布身份

- 运行提交：a1073b8767c16ba48eab90aa2f0d976032ab53d4；分支 codex/storefront-local-refresh-20261017，已推送 GitHub。
- 源码指纹：a39383d337c4b219f28a21d80f7f3229e89ac49edaac690fa56e47e43b89b68a。
- 正式构建：dpl_B8YduhG5zUjCYirDGSuc6xX8fBtV，production / READY，项目 parts-pro-v4 / prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo；www与apex均核对该提交，apex307到www。
- 独立门：SOURCE_GO → STAGE_GO2 → PROMOTE_GO；推广同一构建，没有重新构建或更换源码。
- 回退：保留上一正式 dpl_FU4dTyHQ8MxxtxPsMKTztGYqR64N / f89a515d5da294e947a65fe1e132b06f2cb6835c。仅在需要时由已授权发布流程推广该不可变构建，不自动操作数据库。
- 旧候选1 dpl_7ymbikr1d185csv4yN26o2WMA8k3 / 8260250 未推广；发现首屏空Suspense回退后由最终版本替代，证据已另存。

## 实现与复核

共享StorefrontRefreshProvider与纯调度器合并同账户focus/visibility/session事件，300ms合并、30s有效报价的新鲜窗口；身份变化和明确报价失效立即处理，隐藏时expiry也不丢失。15秒后进入错误终态，旧代和超时晚到响应不能解锁报价；需要显式重试。新失效在进行中的刷新之后排下一代，避免旧快照清掉后到的失效标记。

页面不再按报价/刷新次数重建；仅用户或代客scope变化清除旧私密状态。同账户保留筛选、已加载条数、表单草稿、数量草稿和弹层。价格失效时仅遮住相关报价区域并阻止购买，公共内容继续展示；购买组件保持挂载以保留草稿，旧报价hidden/inert。首次无数据使用公开安全骨架；目录和购物车两处原有null Suspense回退也替换为同款壳。

目录按现有HTTP API刷新已加载内容，每批最多50、并发2，任何新筛选或身份请求取消旧owner；失败停止后续批次，15秒退出等待。后台接管筛选/分页请求会清理旧loading，避免列表永久inert。真实URL导航与同URL刷新分开同步，首次浏览记录恢复固定在scope初始化，避免旧分页或权限变化导致结果污染和滚动回跳。

Cart/checkout保留商品名称、图片、数量、备注和原草稿，仅金额/库存核对区域显示加载或失败状态。独立复核确认7个checkout核心函数与基线逐字相同，订单提交、幂等与unknown结果处理未改。

## 验证证据

- npm run test:storefront：6/6 PASS；相关测试51/51 PASS，包含13项调度/批次、9项commerce异步/门禁以及既有价格/购物车/结算/交互合同。
- npm run lint -- --ignore-pattern 'verification/**'：PASS；排除的是本地验证夹具生成bundle，运行源码仍全量检查。npm run build：本地与正式环境远端均PASS，Next16.2.6/TypeScript/22静态页完成。
- 1097 tracked Git blobs与运行提交一致；450受保护文件无本轮变更；458期望上传文件SHA1全匹配，加唯一校验过的生成next-env.d.ts，共459项，没有env、夹具、文档、测试或数据库目录混入。
- 候选与正式各12条只读HTTP均通过：首页、目录、商品、购物车、结算、登录、专业申请、帮助、账户、售后、后台保护和404。匿名私密页保持登录保护。
- 真实Next生产构建及最终远端候选验证“排序name→目录导航→默认stock_desc”，URL/筛选一致；真实语言菜单Italiano→简体中文完成，24条商品、导航保留；390手机无横向溢出。
- 正式现有用户仅查看目录：24/842商品，1536桌面和390手机header/语言保持，原整页等待文字未出现，浏览器console error0。只读短时15分钟error/fatal日志均0，不等于长期监控保证。
- 实际React组件合成夹具：慢网/断网/15秒错误与重试；focus/visibility事件风暴不重复刷新；隐藏expiry触发1代；旧筛选取消；48条分页刷新后仍48、scrollY恢复；商品数量5保留；结算备注及3张商品图超时后仍在；图片预览刷新后仍打开且焦点保留；换账户/退出立即移除旧私密cards/prices并保留公共搜索和语言。

## 边界与后续

没有数据库、migration、环境变量、API、价格算法、依赖、后台组件或Logo修改，没有db push前置依赖。未执行真实登录切换、订单提交、钱包、库存、资料、售后或消息写入；身份/异常行为通过合成测试会话验证，不能声称真实交易端到端通过。原有submitted待付款文案/汇总口径与只加载部分记录的统计边界问题仍按UI04报告后续治理，本次不改业务协议。

主目录未提交源码保留，没有合并main。运行源码在 .company-tmp/storefront-local-refresh-20261017；后续应从已发布a1073b8继续，不能把主目录旧改动当作当前正式源码。后续归档提交仅改文档，不改变此运行指纹。当前权威状态为docs/roadmap.md。

证据原件在隔离工作区verification/（source-review-ui05.md、release-gate-ui05.md、source-scope-final.json、upload-integrity.json、各测试/构建/HTTP/browser/log报告）。便于查看的截图与摘要在outputs/storefront-local-refresh/2026-10-17/。
