# 公开页面 UI 修复候选验收

日期：2026-10-11。工作树：`.codex-worktrees/frontend-ux-states-release-20261010`。本文件仅覆盖公开页面子助手所有权；Account/Cart/Checkout/RMA、订单 API、repository 与 migration 由主助手集成。所有“已实施”表示本地候选，不表示已发布或真实账户验收。

## 共用组件

- `AsyncFeedback`：loading/empty/error/success/unknown/info，按风险设置 status/alert，支持说明和恢复动作。
- `ActionButton`：继承 Button variants；pending/unknown 锁定重复动作；aria-busy/aria-disabled；链接模式也拦截锁定点击；减少动态效果。
- `useUnsavedChanges(dirty,message)`：刷新/关闭和链接离开确认，不持久化用户资料。
- `useAccountCopy()` 与纯函数 `accountCopy(text,locale)`：将已提取的固定 UI 业务中文映射为意大利语，保留真实客户资料；主助手负责 Account 接入。
- `docs/design/component-states.md` 为状态矩阵。`/internal/component-states` 为无业务写入的演示，production 返回 notFound。

## 逐项实施

| 审计 ID | 候选行为 | 验证与限制 |
|---|---|---|
| U-01 | 手机顶栏常驻搜索，提交/清空都可用 | 定向 lint；320/390 浏览器集成由主助手完成 |
| U-02 | 搜索在 xl 以下独立第二行，避免平板压缩 | 定向 lint；768/820/1024 中意布局待浏览器 |
| U-03 | 输入聚焦时手机/平板收起浮钮；客服打开期间继续可编辑 | 定向 lint；真实键盘/visual viewport 未实测 |
| U-04 | 条件/资料使用说明有独立帮助链接；帮助包含已存在的配送、付款、售后和申请规则 | 不新增承诺或法律条款；仓库未提供独立正式法律隐私政策，帮助是已存在业务规则和申请资料使用说明 |
| U-05 | Auth、数量、详情规格、公开错误、筛选及新增状态词典中意一致；ASCII 分类元数据用已知词典标签回退 | storefront 词典合同通过；Account 独立 mapper 交主助手接入；未知后台动态分类仍依赖其真实双语标签 |
| U-06 | 专用 404/错误页含商城导航、目录搜索/首页恢复入口 | 未读取隐藏商品数据；不存在 SKU 浏览器集成待主助手 |
| U-07 | 桌面、第二行、抽屉搜索有稳定可访问名称 | 定向 lint；键盘/读屏浏览器待验 |
| HOME-01 | 搜索和目录/现货/REMAX前置，手机每区先2款，贴膜机海报手机收紧且咨询入口 | 本地候选；使用现有真实产品资料 |
| HOME-02 | 热卖入口明确“查看现货”，新品入口明确“浏览目录”，REMAX仍保留brand参数 | 不虚造热卖/新品排序查询 |
| CAT-01 | 搜索标题、已加载/总数、条件chips、逐项撤销和有结果时清除全部 | URL状态仍通过现有selectCatalog维护 |
| CAT-02 | 当页现货开关、清楚的默认目录顺序和价格账号说明 | 不公开受保护价格排序 |
| CAT-03 | 替换期间旧网格 inert/aria-hidden，业务动作与详情链接无法误点 | 保留最新请求隔离；慢请求浏览器待验 |
| CAT-04 | 记录失败offset；续页错误位于底部，重试同页；按SKU去重且不清已有结果 | 局部代码及定向 lint；第二页网络失败浏览器待验 |
| CAT-05 | 安全returnTo保留目录条件与companyId；按URL/账号存仅浏览范围和滚动位置，30分钟内重新查询恢复 | pure helper测试通过；不保存价格或客户资料；实际多页滚动返回待浏览器 |
| CARD-01 | 价格独立整行，动作折行、短补货文案、状态文字不会挤掉价格 | 1440五列中意视觉待验 |
| CARD-02 | 手机保留两个型号及可进入详情的+N；搜索匹配型号前置 | 不改审核兼容数据 |
| CARD-03 | 单独SKU、品质及从原商品名/标签提取的材料/带框/频率/颜色摘要 | 摘要只用商品原文，不推断未提供属性 |
| CARD-04 | 登录、账号门禁、无价、缺货等保留不同可见原因；不再整卡降透明度；匿名补货有登录入口 | 真实不同账号门禁待集成；现有价格权限保留 |
| CARD-05 | 图片与标题进入详情，独立44px按钮打开原预览Dialog | 预览/焦点回退浏览器待验 |
| CARD-06 | 卡片主要动作和加减最小44px，数量控件分行避免狭窄相邻动作 | 未将桌面模拟当作真实手机触控验收 |
| DETAIL-01 | 兼容摘要+完整展开，搜索匹配关系前置 | 已有原始兼容数据不变 |
| DETAIL-02 | QC/包装/发票等值允许换行，详情日期按语言与罗马时区 | 320/390视觉待验 |
| DETAIL-03 | 动作改为加入并结算，明确购物车另有N款，已有SKU继续“去结算” | 不改变订单购买意图或购物车数据结构 |
| DETAIL-04 | 独立数量文字草稿，可暂时清空；失焦规范整数；提交仍校验MOQ/库存 | 未放松服务端数量校验 |
| AUTH-01 | 移除成功配置技术公告；异常只显示可行动的业务说明 | 不公开env名称 |
| AUTH-02 | 登录/注册切换，只显示当前密码表单；Google入口和专业审核关系清楚 | Next/Client定向lint；浏览器待集成 |
| AUTH-03 | 忘记密码→通用恢复邮件反馈→PKCE recovery callback→设置密码→回登录 | 合成测试覆盖无效/复用code、marker身份不符、长度/确认、marker单次消费；未发真实邮件、未改真实密码 |
| AUTH-04 | 密码显示/隐藏、8字符规则、正确password manager autocomplete | 不在URL/日志/持久存储保存密码 |
| AUTH-05 | 验证与重发共用一个邮箱；60s倒计时反馈，服务端Auth限流保留 | 验证失败不跳页，输入保留；真实验证码未发送 |
| AUTH-06 | useActionState失败保留邮箱/姓名，错误靠近表单；每次密码失败清空密码DOM输入 | 不保存秘密草稿 |
| AUTH-07（配合） | cleanAuthRedirect拒绝外部URL/反斜线/控制字符；setup带安全returnTo且防嵌套循环 | pure helper测试通过；Account/RMA深链接由主助手处理 |
| B2B-01 | 预填当前授权账号邮箱/姓名；按userId重挂；组织、电话、地址autocomplete/inputMode | 只用已获授权Header DTO；不请求别的客户资料 |
| B2B-02 | 清楚必填/可选；可选发票/备注展开；inline错误和定位 | 原后台必填契约保持 |
| B2B-03 | 明确这里是企业所在地，checkout完整地址须含CAP/门牌；主助手repository已不把其当配送地址 | 未伪造完整配送DTO |
| B2B-04 | 刷新/关闭/链接离开确认；当前JS会话内按账号保留30分钟草稿/状态，账号切换隔离；不写持久个人资料 | 浏览器Back恢复与取消离开待集成；刷新确认离开仍会清草稿 |
| B2B-05 | 15s上限，断连/5xx→unknown锁定原提交，保留资料，提供客服核对 | 现有客户GET始终空且RLS无客户SELECT，不能自助查询或盲目重放；无新增权限/migration；此自助查询范围仍受后端约束 |
| B2B-06 | 成功显示真实申请UUID、公司/邮箱摘要、提交状态和账号/客服下一步；不清空再显示新表单 | UUID由主助手repository生成并写真实行；刷新后在线查询审核状态仍受上述SELECT契约约束 |
| CHAT-C-01 | 父层保留未发送草稿，按userId/会话隔离；旧异步回调不能覆盖新身份草稿 | 只存内存，不写浏览器持久存储；真实账户切换发送待验 |
| CHAT-C-02 | 非模态dialog、打开聚焦、Escape关闭与触发器焦点恢复、中意关闭名称 | 定向lint；真实读屏/键盘待浏览器 |
| CHAT-C-03 | 加载可关闭；模块失败可重试和关闭；重开可重新import | 未制造实际网络chunk失败；浏览器故障注入待验 |

## 本地证据

- 受影响公开组件/Auth路由/帮助页面/辅助hooks/词典定向 `npm run lint -- <明确文件>`：通过。未运行并行全量 build。
- `npm run test:storefront`：6/6 通过（字典键一致、现有commerce状态合同），不能替代E2E。
- `node --test tests/public-ui-navigation.test.mjs`：3/3 通过，包含恶意目标、companyId隔离、原next/setup恢复和防循环。
- `node --test tests/password-recovery-flow.test.mjs`：3/3 通过。实际业务代码以合成Supabase/cookie/redirect适配执行；全部邮箱、用户、密码为合成数据，不访问真实Auth服务。
- `git diff --check`：通过。

读过本地 Next 16 指南：Server/Client Components、Forms、Error Handling、Redirecting、Cookies、Route Handlers、Not Found。Supabase官方密码与resetPasswordForEmail资料已核对；changelog.md的web工具不支持content-type，受限shell网络DNS失败，没有声称完整更新索引已读取。未安装新依赖、未改env/凭据、未直接访问生产或做真实业务写入。

密码恢复发布前仍需确认允许的redirect URL `/auth/recovery` 与SMTP/邮件模板、实际链接单次/过期行为；正式业务页面的桌面/手机浏览器、真实键盘/触控、已登录客服与真实B2B提交由主助手发布验收协调。本候选不声称生产、真实邮件、真实客户业务或物理设备已验收。
