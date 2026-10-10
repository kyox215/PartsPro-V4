# PartsPro 全站前端操作与 UI 审查报告

审查日期：2026年10月10日，Europe/Rome。覆盖商城、客户账户流程与全部后台模块。

**共列出 123 项独立问题、风险与优化点：前台新增 59 项，后台复用并定向核对 64 项。P1 3 项、P2 74 项、P3 46 项。** 这不是“123个已实测故障”：每条明确区分线上实测、源码条件风险和产品优化；同一跨页面根因尽量合并，未发现事故不写成事故。

最需要先处理的是下单结果未知后的重复提交风险（CHECK-01）、后台金额逗号输入（F-01）、后台客服跨会话草稿（S-01），随后是已确认的遮挡/挤压、订单定位、表单草稿与失败恢复。主要简化空间来自**少一次展开、少一次返回重查、少一次重复填写、把当前问题原位解决**，而不是删掉付款、退款、库存、价格或权限核对。

## 阅读方式与优先级

- P1：可能形成资金、订单或内容误处理的风险，优先做防护和专项验证。
- P2：明显影响正确查找、业务理解、恢复或可操作性的缺陷/风险。
- P3：步骤、信息密度、可发现性、阅读或可访问性优化，不等于功能已经不可用。
- 每项都给出触发条件、影响、修正方向、源码引用、证据等级与验收。统计不含单纯“仍需验证”的事项。

## 范围、版本与证据边界

- 授权项目根目录为 `/Users/kyox215/Documents/partspro v4`。当前工作区已有大量未提交改动；此次未修改应用、权限、migration、环境变量或既有报告，未提交/推送/部署。
- 项目发布记录提供的源码基准是 `832c53c916f15ff7bb751aff258b1ad8055a1cbc`，实际可读位置为项目内 `.codex-worktrees/admin-products-ux-20261010`。HEAD `a32c8b9` 相对该运行提交的 src、package/lockfile 与相关配置无差异，已核对。
- **本轮没有调用部署API重新确认实时线上SHA。** 线上问题以本轮实际页面、截图和DOM观察为依据；静态结论固定在上述源码基准。不能把主目录候选、独立修复工作树或项目旧售后实现都称为当前线上版本。
- `docs/roadmap.md`读取时记录后台64项全面修复在独立工作树实施中、尚未发布。本轮不读取或干扰其实现，也不为该任务重新宣称通过验收。后台明细的“待处理”指发布审查基准。
- 新增浏览器检查使用线上匿名IAB。中文检查：首页和手机菜单；意大利语检查：搜索/分类、商品详情、登录、验证码、专业申请、空购物车、匿名结账、账户/RMA门禁和商品404。视口为1280×720、1440×900、768×1024、390×844、320×568，按具体流程选择，未机械覆盖所有组合。
- 实际交互包括手机搜索iPhone 15、切换Schermi分类、打开商品、进入登录、切换语言、展开结账金额及深链接门禁核对。没有提交注册/专业申请、发送验证码/客服消息、加购/清空真实购物车、下单、付款、退款、改库存或直接生产数据库查询。
- 后台原报告已有50个真实React组件与合成数据视口组合、局部模拟交互、线上只读观察及独立复核；此次复用这些证据并核对关键项。它们不是本轮新做的50个检查，也不是完整Next生产E2E。
- 认证、下单与售后仅作所需的只读契约追踪。Vue/Vite旧技能中的目录假设没有套到本项目；实际按Next.js 16/React 19页面与组件定位。
- 未用真实登录客户/管理员进行新写操作；真实iPhone Safari、软键盘、打印设备、邮件送达、并发交易和全部极端内容仍未验收。新报告与既有成功证据不能代替这些验收。

## 页面覆盖表

| 页面或流程 | 本轮浏览器检查 | 源码与复用检查 | 主要问题 |
|---|---|---|---|
| 首页 `/` | 1280中文、390中文、手机菜单/语言切换 | 发布基准横幅/分区/卡片 | 搜索入口、手机首屏层级、查看全部目的地 |
| 目录 `/catalogo` | 390/768/1440意大利语，搜索与分类交互 | 筛选、请求序列、加载更多、商品卡 | 条件不可见、平板搜索挤压、卡片内部溢出 |
| 商品 `/prodotto/[sku]` | 390意大利语正常SKU，320不存在SKU | 兼容、数量、立即下单 | 返回丢筛选、内容截断、404恢复 |
| 登录和验证码 `/login` | 390正常/验证码、320验证码 | 认证失败、注册、重发、回跳 | 技术说明、双表单、无找回密码、重复邮箱 |
| 专业申请 `/professionale`、`/b2b` | 390意大利语申请表；b2b重定向仅源码 | 表单/POST/状态；13字段7必填 | 重复资料、可选字段、草稿与等待恢复 |
| 购物车 `/carrello` | 390匿名门禁 | 清空、数量、账号同步 | 缺少撤销、批量采购机会 |
| 结账 `/checkout` | 390匿名、底栏金额展开 | 报价/订单/资料/配送/支付；下单风险独立复核 | 超时重试、依赖提示、资料往返、手机说明 |
| 个人中心 `/account` | 匿名订单页签深链接回跳 | 登录后订单/钱包/资料/物流展示；竞态独立复核 | 200单/8笔范围、详情竞态、资料关闭与文案 |
| 客户售后 `/rma` | 匿名门禁 | 最新已发布客户表单/照片/申请/发货流程 | 订单检索、已有申请定位、读取/刷新恢复 |
| 客户客服 | 公开浮钮位置；短屏覆盖 | 面板草稿/加载/键盘路径 | 浮钮遮挡、草稿丢失、加载无法关闭 |
| 全部后台 `/admin` 与 `/admin/remax` | 本轮未新做登录浏览 | 既有64项＋关键源码复核 | 导航、订单、商品/目录/库存/导入、售后、账号/价格、财务、eBay、客服、设置等 |
| 网站统计 | 本轮没有可用线上统计页验收 | 发布基准禁用，主目录有接入候选 | G-04，版本区别必须保留 |

## 优先处理清单

| 顺序 | 项目 | 影响 | 最小行动 |
|---|---|---|---|
| 1 | CHECK-01 下单结果未知 | 可能重复订单/预留/钱包动作 | 结果待确认＋可靠同次请求回放，隔离事务验证 |
| 2 | F-01 逗号金额 | 12,50可能变null并解析为0 | 前端有限金额解析＋API拒绝null/空/非有限值 |
| 3 | S-01 / S-03 客服草稿与详情对象 | 草稿或失败旧详情可能属于另一会话 | 草稿按会话绑定，提交核对当前会话 |
| 4 | U-02 / U-03 / CARD-01 / F-08 / G-02 | 搜索不能读、输入/菜单/内容被挡 | 先修容器与断点，再做目标宽度交互 |
| 5 | CAT-05 / AUTH-07 / RMA-C-02 / O-04 / A-05 | 返回与通知后重复定位 | 完整目的地址、稳定筛选/页码、就近链接 |
| 6 | ACCOUNT-03 / ACCOUNT-04 / CHECK-04 / O-01 / O-02 | 请求竞态、关闭丢输入、保存误报失败 | 当前请求保护、统一关闭守卫、写入与回读分离 |
| 7 | U-05 / ACCOUNT-05 / CHECK-05 / A-06 / E-06 | 语言/业务说明不一致 | 关键流程词典与状态契约统一 |
| 8 | ACCOUNT-01 / ACCOUNT-02 / F-04 / R-02 / I-01 / S-02 | 历史或队列范围不全 | 明确范围、查询/分页、关联详情与导出范围 |

## 可以缩短的操作路径

步骤按用户可见的任务阶段计算，不是精确点击计数；收益需要用代表性用户任务验证。

| 任务 | 当前路径 | 建议路径 | 可减少的负担 | 问题ID |
|---|---|---|---|---|
| 手机找SKU | 开菜单→输入→搜索 | 直接输入→搜索 | 每轮少一次展开 | U-01 |
| 比较两款配件 | 筛选→详情→返回全目录→重新筛选 | 筛选→详情→返回原结果 | 消除重复关键词/分类与找位置 | CAT-05 |
| 查看通知指定订单 | 深链接→登录→账户总览→订单→找该单 | 深链接→登录→指定单 | 消除重新定位 | AUTH-07、ACCOUNT-01 |
| 查看已有售后 | 个人中心打开→新表单顶部→向下找申请 | 打开→对应申请卡 | 复用现有requestId定位 | RMA-C-02 |
| 结账缺地址 | 去个人中心→补资料→再找结账→重选/重写 | 原位补资料→回原结账 | 保留支付/配送/备注 | CHECK-04 |
| 切换收货地址 | 展开只有一个地址的下拉→没有其他选择 | 地址摘要→编辑/真实多地址选择 | 消除无效步骤 | CHECK-03 |
| 专业客户申请 | 重新输入已有邮箱/姓名/地址→填所有字段 | 核对预填→只补必要字段 | 减少重复填写和长表单 | B2B-01/02/03 |
| 密码忘记 | 联系客服或尝试其他账号 | 找回→恢复→回原目标 | 增加自助恢复，避免重复注册 | AUTH-03 |
| 订单详情读失败 | 关弹层→找同一单→重新开 | 原位重试 | 少一次返回查找 | ACCOUNT-06 |
| 查钱包退款来源 | 看最近8笔→联系客服 | 全部流水→关联订单/售后 | 减少人工核对 | ACCOUNT-02 |
| 十几款采购 | 逐个搜索→加购→调数量 | 粘贴SKU数量→校验预览→确认入车 | 批量采购机会 | CART-02 |
| 后台找订单 | 换页→逐行找→开详情 | 订单号/客户/日期→详情 | 利用已有查询接口 | O-04、G-01 |
| 后台保存表单失败 | 表单已关→重新开→重填 | 原表单错误→直接改/重试 | 保留输入与明确提交结果 | O-01、O-02、F-06 |
| 后台记错财务 | 联系维护人员处理 | 精确记录→受控更正 | 原位纠错并保留审计 | F-05 |
| eBay准备刊登 | 修改配置→直接生成→发现实际用旧值 | 核对配置→保存→生成可审计划 | 防配置草稿与执行目标错配 | E-01、E-02 |

## 明确错位与布局问题

| 问题 | 条件和证据 | 判定 |
|---|---|---|
| 平板顶栏搜索文字只剩约11.8px空间 | 本轮线上768，搜索框95.8px，内边距84px | 已复现 U-02 |
| 客服浮钮覆盖验证码邮箱右侧 | 本轮线上320×568 | 已复现 U-03 |
| 补货按钮伸出卡片，左侧提示宽0 | 本轮线上1440，按钮197.9px/内容行190.4px | 已复现 CARD-01 |
| 商品图下QC文字被省略 | 本轮线上390意大利语 | 已复现内容裁切 DETAIL-02 |
| 财务页签多行覆盖下面内容 | 既有360意大利语合成组件几何复现，公共h-8覆盖h-auto | 既有实证 F-08；非本轮新线上复现 |
| 短屏侧栏账号区盖住菜单 | 既有1280×568线上和合成组件 | 既有实证 G-02 |
| 批次/电商宽表 | 既有报告的平板/手机布局分析 | 优化/长内容候选；不把内部横向滚动都算整页错位 |
| 多型号详情徽标裁切 | max-height 58px + overflow-hidden | 源码长内容条件 DETAIL-01；单型号样本未触发 |
| 固定浮层遇真实软键盘 | 既有公共OverlayViewport防护存在 | 真机待复验；不能说完全没有键盘保护 |

本轮已记录的公共页面样本未出现整页横向溢出或破图。这个结果不覆盖所有商品、登录状态和软键盘，也不能推翻卡片内部溢出/内容裁切的实证。

## 本轮线上截图

截图全部为匿名公开页面；不存在的SKU和验证码模式用于只读状态检查，没有提交业务表单。

![平板顶栏搜索被挤压](../../outputs/frontend-audit/2026-10-10/catalog-search-768-it.jpg)

![桌面商品卡内部操作行挤压](../../outputs/frontend-audit/2026-10-10/catalog-search-1440-it.jpg)

![短屏验证码页客服浮钮遮挡邮箱](../../outputs/frontend-audit/2026-10-10/verify-email-320-it.jpg)

![失效商品默认404缺少恢复入口](../../outputs/frontend-audit/2026-10-10/product-not-found-320-it.jpg)

局部证据：[平板搜索栏局部](../../outputs/frontend-audit/2026-10-10/tablet-header-768-it.jpg)。完整长页截图中的固定控件位于采样首屏坐标，不据此推断其他滚动位置的遮挡。

其他截图：[手机首页](../../outputs/frontend-audit/2026-10-10/home-390-zh.jpg)、[手机菜单](../../outputs/frontend-audit/2026-10-10/home-menu-390-zh.jpg)、[手机目录搜索](../../outputs/frontend-audit/2026-10-10/catalog-search-390-it.jpg)、[分类结果](../../outputs/frontend-audit/2026-10-10/catalog-schermi-390-it.jpg)、[商品详情](../../outputs/frontend-audit/2026-10-10/product-390-it.jpg)、[登录](../../outputs/frontend-audit/2026-10-10/login-390-it.jpg)、[邮箱验证](../../outputs/frontend-audit/2026-10-10/verify-email-390-it.jpg)、[专业申请](../../outputs/frontend-audit/2026-10-10/professional-390-it.jpg)、[空购物车](../../outputs/frontend-audit/2026-10-10/cart-empty-390-it.jpg)、[匿名结账](../../outputs/frontend-audit/2026-10-10/checkout-anonymous-390-it.jpg)。

## 前台问题索引

前台共59项，P1 1、P2 34、P3 24。

| ID | 优先级 | 页面 | 问题 | 性质 |
|---|---|---|---|---|
| [U-01](#u-01) | P3 | 公共导航 | 手机搜索需要先打开菜单 | 步骤优化 |
| [U-02](#u-02) | P2 | 公共导航 | 平板顶栏搜索框被其他控件挤到几乎无法阅读 | 已复现布局问题 |
| [U-03](#u-03) | P2 | 公共导航 | 客服浮钮会挡住短屏表单控件 | 已复现遮挡 |
| [U-04](#u-04) | P2 | 公共导航 | 专业申请要求同意条件和隐私却没有可查看的内容入口 | 信息与路径缺口 |
| [U-05](#u-05) | P2 | 公共导航 | 前台多语言覆盖不完整且关键账户流程仍大量写死中文 | 语言不一致 |
| [U-06](#u-06) | P2 | 公共导航 | 失效商品进入默认英文404且没有返回商城的入口 | 已复现恢复缺口 |
| [U-07](#u-07) | P3 | 公共导航 | 搜索输入依赖占位符而缺少明确标签 | 可访问性优化 |
| [HOME-01](#home-01) | P3 | 首页 | 手机首页的促销和长商品分区占据大量滚动空间 | 信息层级优化 |
| [HOME-02](#home-02) | P2 | 首页 | 热卖和新品的查看全部没有保持该分区的浏览意图 | 导航语义不一致 |
| [CAT-01](#cat-01) | P2 | 商品目录 | 结果页缺少清楚的关键词、当前条件、总数和清除入口 | 筛选上下文缺口 |
| [CAT-02](#cat-02) | P3 | 商品目录 | 现货筛选和排序没有直接的结果页控件 | 查找步骤优化 |
| [CAT-03](#cat-03) | P2 | 商品目录 | 新筛选加载时旧商品仍可点击和操作 | 交互状态风险 |
| [CAT-04](#cat-04) | P3 | 商品目录 | 加载更多失败的重试会重新读取第一页 | 失败恢复优化 |
| [CAT-05](#cat-05) | P2 | 商品目录 | 商品详情的返回目录丢掉原搜索和筛选 | 返回路径缺口 |
| [CARD-01](#card-01) | P2 | 商品卡片 | 意大利语补货按钮挤掉价格提示并伸出卡片 | 已复现内部溢出 |
| [CARD-02](#card-02) | P2 | 商品卡片 | 手机只显示首个兼容型号且不提示还有更多 | 商品信息隐藏 |
| [CARD-03](#card-03) | P3 | 商品卡片 | 标题截断后难以区分材质版本等关键差异 | 比较效率优化 |
| [CARD-04](#card-04) | P3 | 商品卡片 | 未登录和真正不可购买的视觉状态过于接近 | 状态表达优化 |
| [CARD-05](#card-05) | P3 | 商品卡片 | 点击商品图片先进入预览而不是详情 | 步骤优化 |
| [CARD-06](#card-06) | P3 | 商品卡片 | 手机购物和数量控件触控区偏紧 | 触控与密度优化 |
| [DETAIL-01](#detail-01) | P2 | 商品详情 | 完整兼容型号被固定高度隐藏且无展开 | 内容裁切风险 |
| [DETAIL-02](#detail-02) | P3 | 商品详情 | 手机快速规格的正文被省略且缺少完整查看 | 已复现文字裁切 |
| [DETAIL-03](#detail-03) | P2 | 商品详情 | 立即下单实际上会结算已有购物车的全部商品 | 操作语义风险 |
| [DETAIL-04](#detail-04) | P3 | 商品详情 | 数量输入每次变更立即规范为至少1，难以暂时清空 | 数量输入优化 |
| [AUTH-01](#auth-01) | P3 | 登录注册 | 技术状态说明占据登录首屏的大块位置 | 信息层级优化 |
| [AUTH-02](#auth-02) | P3 | 登录注册 | 登录和注册两套邮箱密码表单直接堆在同一页 | 流程简化 |
| [AUTH-03](#auth-03) | P2 | 登录注册 | 没有找回密码入口及恢复流程 | 账户恢复缺口 |
| [AUTH-04](#auth-04) | P3 | 登录注册 | 密码缺少可见性切换和提前的长度说明 | 输入体验优化 |
| [AUTH-05](#auth-05) | P2 | 登录注册 | 验证码验证与重发分别维护两份邮箱输入 | 重复输入与一致性风险 |
| [AUTH-06](#auth-06) | P3 | 登录注册 | 认证失败后缺少明确的邮箱和姓名恢复策略 | 失败恢复优化 |
| [AUTH-07](#auth-07) | P2 | 登录注册 | 个人中心和售后深链接登录后会丢掉目标参数 | 登录回跳缺口 |
| [B2B-01](#b2b-01) | P3 | 专业客户申请 | 已有账户信息和浏览器自动填充未充分复用 | 重复输入优化 |
| [B2B-02](#b2b-02) | P3 | 专业客户申请 | 必填可选字段没有清晰区分且全部铺开 | 表单分层优化 |
| [B2B-03](#b2b-03) | P2 | 专业客户申请 | 申请地址与账户配送地址采用不同模型，容易重复填写 | 资料流程不一致 |
| [B2B-04](#b2b-04) | P2 | 专业客户申请 | 离开或刷新长申请表没有草稿保护 | 草稿丢失风险 |
| [B2B-05](#b2b-05) | P2 | 专业客户申请 | 发送申请缺少应用层超时和结果未知处理 | 等待恢复缺口 |
| [B2B-06](#b2b-06) | P3 | 专业客户申请 | 申请成功缺少本次申请的可追踪结果 | 成功后流程优化 |
| [CART-01](#cart-01) | P2 | 购物车 | 清空和移除缺少撤销，操作会影响账号购物车 | 误操作恢复缺口 |
| [CART-02](#cart-02) | P3 | 购物车 | 缺少按多SKU与数量快速建车的入口 | B2B批量效率机会 |
| [CHECK-01](#check-01) | P1 | 结账 | 下单超时后引导重试而缺少同次提交防重 | 跨层结果未知风险 |
| [CHECK-02](#check-02) | P2 | 结账 | 未登录结账同时铺出多种后续问题和可编辑表单 | 门禁与信息层级缺陷 |
| [CHECK-03](#check-03) | P3 | 结账 | 已保存地址用只有一个选项的下拉框且缺少就近修改 | 无效步骤优化 |
| [CHECK-04](#check-04) | P2 | 结账 | 去补资料或回购物车后缺少结账草稿恢复 | 往返恢复缺口 |
| [CHECK-05](#check-05) | P2 | 结账 | 手机隐藏付款方式的关键说明 | 手机信息缺失 |
| [CHECK-06](#check-06) | P3 | 结账 | 隐藏的配送和付款单选缺少明显的焦点状态 | 键盘交互风险 |
| [ACCOUNT-01](#account-01) | P2 | 个人中心 | 订单历史最多读200条且无搜索分页说明 | 查找与范围缺口 |
| [ACCOUNT-02](#account-02) | P2 | 个人中心 | 钱包只展示最近8笔且无法查看完整或关联订单 | 资金可解释性缺口 |
| [ACCOUNT-03](#account-03) | P2 | 个人中心 | 快速关闭再打开另一订单会被旧详情响应覆盖 | 请求竞态风险 |
| [ACCOUNT-04](#account-04) | P2 | 个人中心 | 资料弹层未保存和保存中都缺少统一关闭保护 | 草稿与关闭保护缺口 |
| [ACCOUNT-05](#account-05) | P2 | 个人中心 | 补全资料后的权限说明前后不一致 | 业务文案矛盾 |
| [ACCOUNT-06](#account-06) | P3 | 个人中心 | 订单详情读失败只能关闭重开，没有原位重试 | 失败恢复优化 |
| [ACCOUNT-07](#account-07) | P2 | 个人中心 | 订单详情未展示API已经提供的物流与追踪信息 | 前后端展示遗漏 |
| [RMA-C-01](#rma-c-01) | P3 | 客户售后 | 待选订单和商品全部铺成卡片，没有检索 | 查找效率优化 |
| [RMA-C-02](#rma-c-02) | P2 | 客户售后 | 个人中心打开已有申请却跳到新申请表顶部 | 上下文跳转缺口 |
| [RMA-C-03](#rma-c-03) | P2 | 客户售后 | 售后数据读取失败后没有专用重试且容易出现无订单提示 | 读取失败恢复缺口 |
| [RMA-C-04](#rma-c-04) | P2 | 客户售后 | 照片与上传恢复状态只在内存，刷新会丢当前进度 | 页面生命周期恢复风险 |
| [CHAT-C-01](#chat-c-01) | P2 | 客户客服 | 关闭客服窗口会丢掉未发送文字 | 草稿丢失风险 |
| [CHAT-C-02](#chat-c-02) | P3 | 客户客服 | 客服面板缺少明确的打开焦点与关闭返回 | 键盘可达性优化 |
| [CHAT-C-03](#chat-c-03) | P2 | 客户客服 | 客服模块加载时关闭按钮被禁用 | 加载恢复缺口 |

## 前台全部问题明细

## 公共导航

<a id="u-01"></a>

### U-01 [P3] 手机搜索需要先打开菜单

**性质：** 步骤优化。

**现象与触发条件：** 390宽首页和目录顶栏只有菜单、品牌、购物车和账号；搜索框位于菜单抽屉中。实际执行路径为打开菜单→输入关键词→搜索。

**用户影响：** 维修店的高频任务是按机型或SKU找配件，每次查询多一次展开，当前搜索条件也不在首屏。

**建议简化或修正：** 在手机目录首屏提供常驻搜索或明确搜索按钮；首页也可保留一行紧凑搜索。路径变为输入→搜索。

**证据：** 本轮线上390中文菜单和意大利语搜索实测；home-menu-390-zh.jpg、catalog-search-390-it.jpg。 [store-header.tsx:184](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-header.tsx:184>)、[store-mobile-menu.tsx:191](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-mobile-menu.tsx:191>)

**验收：** 390和320宽能够直接发现搜索；提交、清空和返回后关键词正确保留；菜单仍能浏览目录。

<a id="u-02"></a>

### U-02 [P2] 平板顶栏搜索框被其他控件挤到几乎无法阅读

**性质：** 已复现布局问题。

**现象与触发条件：** 768×1024意大利语目录中，搜索框宽95.8125px，左右内边距分别36/48px，文字实际可用宽度约11.8px；输入iPhone 15只能看见很短的开头。

**用户影响：** 用户无法核对输入，长SKU尤其难以纠错。没有整页横向溢出也不代表顶栏可用。

**建议简化或修正：** 在平板将搜索放到第二行，或缩短标语/语言和购物车文字；为搜索设置合理最小文字宽度，断点按控件总宽度调整。

**证据：** 本轮线上截图与DOM尺寸读取；catalog-search-768-it.jpg、browser-observations.json。 [store-header.tsx:184](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-header.tsx:184>)、[store-header.tsx:190](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-header.tsx:190>)

**验收：** 768/820/1024宽与两种语言，输入20位SKU和长机型名可阅读并修改，按钮不挤压输入。

<a id="u-03"></a>

### U-03 [P2] 客服浮钮会挡住短屏表单控件

**性质：** 已复现遮挡。

**现象与触发条件：** 320×568验证码页中，右下客服圆钮盖住邮箱输入框右端；公共浮钮仅对购物车/结账操作栏做专门偏移，普通表单没有避让。

**用户影响：** 输入、查看邮箱末尾和点击控件右侧会受到遮挡，软键盘出现后的风险还需真机复验。

**建议简化或修正：** 表单聚焦时收起或移动浮钮；给固定控件统一避让规则；保留清晰的联系客服入口。

**证据：** 本轮线上320截图直接确认；verify-email-320-it.jpg。未模拟真实软键盘。 [support-widget.tsx:83](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-widget.tsx:83>)、[support-widget.tsx:44](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-widget.tsx:44>)

**验收：** 320×568和390短屏、邮箱/验证码聚焦、页面滚动及真机键盘打开时，浮钮不覆盖输入和主要按钮。

<a id="u-04"></a>

### U-04 [P2] 专业申请要求同意条件和隐私却没有可查看的内容入口

**性质：** 信息与路径缺口。

**现象与触发条件：** 申请页两项勾选文案提到条件和隐私，但ConsentRow仅输出文本；公共导航也没有相应帮助/条件入口。

**用户影响：** 用户不能在当前流程核对自己将同意的内容，需要联系客服询问，增加申请阻力。此处是可发现性问题，不作法律合规结论。

**建议简化或修正：** 在勾选旁提供对应内容链接或可读弹层，并建立稳定的配送、付款、售后和申请帮助入口。

**证据：** 本轮线上申请页控件核对＋源码；professional-390-it.jpg。 [professional-application-page.tsx:392](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:392>)、[professional-application-page.tsx:534](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:534>)

**验收：** 键盘和手机均可打开内容、关闭后保留表单；链接与勾选语义明确，不误触提交。

<a id="u-05"></a>

### U-05 [P2] 前台多语言覆盖不完整且关键账户流程仍大量写死中文

**性质：** 语言不一致。

**现象与触发条件：** account-page的订单、钱包、资料、状态和错误大多为中文常量；login的errorMessages/noticeMessages固定意大利文；商品详情Dettagli rapidi、Brand、Aggiornato和数量提示也有固定意大利文；本轮切回中文后，分类选项仍显示Accessori、Batterie esterne、Caricatori、Cavi dati。

**用户影响：** 意大利客户可用意大利语购物，却可能在资料、历史订单和钱包处遇到中文；中文用户在失败路径又遇到意大利文。

**建议简化或修正：** 统一这些实际业务文案的词典入口和目录双语显示配置；优先翻译保存、错误、审核状态、资金与订单信息，再处理辅助字段。日期格式随当前语言并明确业务时区。

**证据：** 源码确认；本轮公开页看到固定字段，切回中文后确认部分分类选项仍为意大利文。已登录个人中心的整页语言需后续浏览器复验。 [account-page.tsx:686](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:686>)、[page.tsx:34](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:34>)、[product-detail-page.tsx:270](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-page.tsx:270>)、[account-page.tsx:1877](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1877>)

**验收：** 中意两种语言覆盖正常/加载/空/失败/资料未全/订单详情/钱包；错误提示不能只验证成功状态。

<a id="u-06"></a>

### U-06 [P2] 失效商品进入默认英文404且没有返回商城的入口

**性质：** 已复现恢复缺口。

**现象与触发条件：** 访问不存在的商品SKU后，最终只显示404 / This page could not be found.，商城导航消失，客服浮钮仍在。项目没有专用not-found页面。

**用户影响：** 从旧链接、收藏或下架商品进入的客户只能依赖浏览器后退，无法重新找相似商品。

**建议简化或修正：** 提供带商城导航、当前语言和目录搜索的商品失效页，清楚说明商品暂不可用，并提供返回目录/首页。

**证据：** 本轮线上人为构造一个不存在SKU的只读检查；product-not-found-320-it.jpg。 [page.tsx:50](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/prodotto/[sku]/page.tsx:50>)

**验收：** 不存在SKU和下架链接得到可恢复页面；不存在的商品不能伪装成正常详情，也不能泄露隐藏资料。

<a id="u-07"></a>

### U-07 [P3] 搜索输入依赖占位符而缺少明确标签

**性质：** 可访问性优化。

**现象与触发条件：** 桌面和菜单搜索没有label/aria-label，主要依赖placeholder；输入内容后视觉上也没有常驻字段名。部分浏览器可能把placeholder作为名称，不应等同为完全无可访问名称。

**用户影响：** 读屏、语音操作和输入纠错时语义不稳定；两处重复搜索难以清楚指认。

**建议简化或修正：** 为搜索加稳定的程序化名称，必要时用sr-only标签；保持搜索按钮与输入的关系明确。

**证据：** 源码与本轮DOM字段标签读取；不是完整可访问性认证。 [store-header.tsx:192](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-header.tsx:192>)、[store-mobile-menu.tsx:191](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-mobile-menu.tsx:191>)

**验收：** 辅助技术能区分目录搜索和搜索按钮，输入前后名称稳定，Tab能到达并提交。

## 首页

<a id="home-01"></a>

### HOME-01 [P3] 手机首页的促销和长商品分区占据大量滚动空间

**性质：** 信息层级优化。

**现象与触发条件：** 390首屏先展示约440px高的贴膜机海报，然后REMAX预订；维修配件的其他分区在后方。观察样本首页总高约6084px，多个区块各列多款产品。海报按钮只进入通用目录。

**用户影响：** 按手机机型找维修配件的人需要先打开菜单或向下滚动；看海报后还需再查对应产品。

**建议简化或修正：** 把高频搜索、系列/品牌快捷入口前置；手机每区先展示少量代表商品，再提供真正对应的查看全部。海报提供明确产品/咨询目的。

**证据：** 本轮线上390首页截图与页面高度观察；home-390-zh.jpg。具体缩减数量是优化建议。 [home-page.tsx:202](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/home-page.tsx:202>)、[home-page.tsx:241](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/home-page.tsx:241>)

**验收：** 手机首屏能找到配件搜索和目录主入口；促销仍可见，区块入口的目标与标题一致。

<a id="home-02"></a>

### HOME-02 [P2] 热卖和新品的查看全部没有保持该分区的浏览意图

**性质：** 导航语义不一致。

**现象与触发条件：** 本轮可见链接中，热卖产品的查看全部指向/catalogo?minStock=1，新到产品指向/catalogo；它们没有分别进入热卖排序或新品排序。REMAX入口已经带brand=REMAX，应保留。

**用户影响：** 客户以为打开全部热卖/新品，实际看到一般现货或全目录，要重新查找。

**建议简化或修正：** 提供对应排序/集合页；如没有这些查询能力，按钮明确写查看现货/浏览全部目录，避免暗示不存在的集合。

**证据：** 本轮线上首页DOM确认实际href；首页截图＋源码。 [home-page.tsx:101](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/home-page.tsx:101>)、[home-page.tsx:119](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/home-page.tsx:119>)

**验收：** 核对四个首页分区的入口、URL、结果标题和排序；不能把REMAX正确链接再列为缺陷。

## 商品目录

<a id="cat-01"></a>

### CAT-01 [P2] 结果页缺少清楚的关键词、当前条件、总数和清除入口

**性质：** 筛选上下文缺口。

**现象与触发条件：** 手机搜索iPhone 15后，内容区只显示Categoria和商品卡；关键词在菜单中，结果总数未展示。清除全部按钮主要出现在无结果状态；桌面也没有清晰的结果标题和条件汇总。

**用户影响：** 看不出是否还带着旧关键词、现货/品牌条件，容易把过滤结果误认为全部目录。

**建议简化或修正：** 在结果上方显示关键词、选中条件、总数/已加载数及逐项清除；有结果时也能一键重置。

**证据：** 本轮390、768、1440线上目录观察；catalog-search-390-it.jpg、catalog-search-1440-it.jpg。 [catalog-page.tsx:389](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:389>)、[catalog-page.tsx:237](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:237>)、[catalog-page.tsx:568](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:568>)

**验收：** 搜索＋分类＋现货＋品牌组合可见、可独立撤销；返回和浏览器前后退时条件一致。

<a id="cat-02"></a>

### CAT-02 [P3] 现货筛选和排序没有直接的结果页控件

**性质：** 查找步骤优化。

**现象与触发条件：** 目录支持minStock条件，但公开结果区主要只有商品分类；从全目录想切到仅现货，缺少明确的当前页开关。也没有面向用户的价格/新品等排序控件。

**用户影响：** 维修店查急用件要借首页现货入口，比较大量近似商品时要滚动找。

**建议简化或修正：** 先补仅现货开关及清楚的默认排序说明；仅在数据和价格权限允许时增加必要排序，避免堆满筛选。

**证据：** 结果页源码与本轮线上控件确认；新增排序属于产品优化，不表示现有API已经支持所有排序。 [catalog-page.tsx:95](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:95>)、[catalog-page.tsx:484](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:484>)

**验收：** 当前页一次点击切换现货，URL和总数同步；受保护价格不被匿名排序泄露。

<a id="cat-03"></a>

### CAT-03 [P2] 新筛选加载时旧商品仍可点击和操作

**性质：** 交互状态风险。

**现象与触发条件：** catalogReplacing时旧网格只加opacity-45，ProductCard并未收到禁用状态；骨架层使用pointer-events-none。最新请求保护已存在，但它只防旧响应覆盖。

**用户影响：** 用户刚选新分类，却可能点击或加入仍显示的旧分类商品，尤其慢网时容易误操作。

**建议简化或修正：** 替换结果期间锁定旧列表的业务动作，明确这些是旧结果；图片阅读是否保留可按体验选择。

**证据：** 源码确认；本轮筛选切换瞬间看到旧结果，未在生产制造延迟或执行加购。 [catalog-page.tsx:502](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:502>)、[catalog-page.tsx:522](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:522>)、[catalog-page.tsx:38](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:38>)

**验收：** 模拟慢查询后连续切筛选，旧卡不能新增购买动作；新结果到达后恢复，无竞态和焦点丢失。

<a id="cat-04"></a>

### CAT-04 [P3] 加载更多失败的重试会重新读取第一页

**性质：** 失败恢复优化。

**现象与触发条件：** 加载更多走offset=products.length；错误后的通用重试调用loadCatalogSelection(selectedCatalog)，默认offset=0。

**用户影响：** 已经向下浏览多页后重试，列表可能回到首批，原位置和加载范围丢失。

**建议简化或修正：** 保存失败请求的offset；加载更多失败在底部原位重试，筛选替换失败与续页失败分开处理。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [catalog-page.tsx:269](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:269>)、[catalog-page.tsx:537](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:537>)、[catalog-page.tsx:340](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/catalog-page.tsx:340>)

**验收：** 模拟第二/第三页失败，重试仅补缺页，不重复SKU、不清掉已加载结果，位置稳定。

<a id="cat-05"></a>

### CAT-05 [P2] 商品详情的返回目录丢掉原搜索和筛选

**性质：** 返回路径缺口。

**现象与触发条件：** 从/catalogo?category=Schermi&q=iPhone+15进入商品后，Torna al catalogo的href固定为/catalogo，只保留代客公司上下文。

**用户影响：** 一次看详情后就要重新输入机型、选择分类、找原位置；比较多款商品成本明显增加。

**建议简化或修正：** 传递经过校验的返回地址或保存目录上下文，恢复关键词、分类、已加载范围和滚动位置；直接打开详情时仍回通用目录。

**证据：** 本轮线上详情href确认；product-back-link记录与product-390-it.jpg。 [product-detail-page.tsx:92](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-page.tsx:92>)

**验收：** 筛选→详情→页面返回，URL与位置恢复；浏览器后退、直接链接、代客下单上下文都正确。

## 商品卡片

<a id="card-01"></a>

### CARD-01 [P2] 意大利语补货按钮挤掉价格提示并伸出卡片

**性质：** 已复现内部溢出。

**现象与触发条件：** 1440目录五列布局中卡宽约210.4px，内容行约190.4px；补货按钮约197.9px，且不收缩。左侧价格提示宽度被压到0，按钮右侧超出卡片边界约1.5px、超出内容区约11.5px。

**用户影响：** 登录/价格说明消失，按钮和文本对齐破坏；即使整页scrollWidth正常，卡片内部仍有真实错位。

**建议简化或修正：** 卡片操作行允许折行或改上下布局；缩短按钮文案并保留完整说明；按卡片宽度而非只按视口决定布局。

**证据：** 本轮线上截图和精确DOM尺寸；catalog-search-1440-it.jpg、browser-observations.json。 [product-card.tsx:287](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:287>)、[product-restock-reminder-button.tsx:83](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-restock-reminder-button.tsx:83>)、[globals.css:176](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/globals.css:176>)

**验收：** 1400/1440/1500宽、中意、补货/已保存/错误状态；价格或门禁说明不能被压到0，按钮不越界。

<a id="card-02"></a>

### CARD-02 [P2] 手机只显示首个兼容型号且不提示还有更多

**性质：** 商品信息隐藏。

**现象与触发条件：** 卡片兼容型号取前两项，但第二项hidden sm:inline-flex，+N也在手机隐藏；即使商品兼容多个型号，手机只见第一个。

**用户影响：** 按另一个兼容机型查到商品的人，会误以为不适配；跨型号共享件尤其容易被错过。

**建议简化或修正：** 手机显示当前检索匹配型号，并保留可打开的全部兼容/+N；至少不要同时隐藏第二项和更多提示。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [product-card.tsx:260](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:260>)、[product-card.tsx:267](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:267>)

**验收：** 两型号和多型号商品、按非首个型号搜索、长型号名；当前适配关系可明确核对。

<a id="card-03"></a>

### CARD-03 [P3] 标题截断后难以区分材质版本等关键差异

**性质：** 比较效率优化。

**现象与触发条件：** 标题统一line-clamp-2，卡片没有稳定的独立SKU/品质版本对比行；1440五列时多个Incell/Soft Oled商品都出现相近的截断标题。

**用户影响：** 客户需反复进入详情才能辨别型号、120Hz、框架和版本差异，增加误选概率。

**建议简化或修正：** 把型号、材料/品质、带框与颜色等关键差异从长标题中提取为少量属性；保留短SKU或清楚的详情查看。

**证据：** 本轮线上五列截图确认截断；catalog-search-1440-it.jpg。属性提取方案需保持真实商品契约。 [product-card.tsx:238](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:238>)

**验收：** 用仅材质/带框/刷新率不同的真实商品做并排比较，不依赖悬停才能读出关键差异。

<a id="card-04"></a>

### CARD-04 [P3] 未登录和真正不可购买的视觉状态过于接近

**性质：** 状态表达优化。

**现象与触发条件：** 不能加购的卡片统一opacity-80；匿名可见灰色购物车图标有时还能打开说明，缺货提醒又是disabled。手机按钮文字被sr-only隐藏。

**用户影响：** 用户难分辨需登录、缺货、未报价、待审核或只是说明按钮；外观看似不可点的控件实际可点击。

**建议简化或修正：** 用不同状态文字和图标解释当前限制；需要登录的动作明确呈现登录，不把整张商品卡普遍降透明度。

**证据：** 本轮匿名线上卡片观察＋源码；未执行真实加购或补货提醒。 [product-card.tsx:195](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:195>)、[product-card.tsx:446](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:446>)、[product-restock-reminder-button.tsx:37](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-restock-reminder-button.tsx:37>)

**验收：** 匿名、有价、无价、缺货、审核中、暂停账号等状态可区分；禁用理由有可达的替代入口。

<a id="card-05"></a>

### CARD-05 [P3] 点击商品图片先进入预览而不是详情

**性质：** 步骤优化。

**现象与触发条件：** 图片主点击只setPreviewOpen(true)，商品标题才是详情链接。对习惯点商品图购物的人，需关预览再点标题。

**用户影响：** 详情、价格解释和购买入口多一步；小标题在手机上不如大图容易点。

**建议简化或修正：** 按业务选择图片主点击进详情、独立放大图标预览；或在预览中提供清楚的查看详情。保留需要检查配件照片的放大能力。

**证据：** 源码确认的操作模型优化；图片预览本身不是故障。 [product-card.tsx:210](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:210>)、[product-card.tsx:235](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:235>)

**验收：** 从图和标题都能明确进入预期目的；预览可退出并恢复焦点，无嵌套交互冲突。

<a id="card-06"></a>

### CARD-06 [P3] 手机购物和数量控件触控区偏紧

**性质：** 触控与密度优化。

**现象与触发条件：** 卡片加购/门禁/补货按钮常用size-8即32px，数量加减也采用紧凑图标控件；左右相邻时需精准点击。

**用户影响：** 单手、戴手套或快速补货时更容易点错；信息密度高不应靠缩小主要动作维持。

**建议简化或修正：** 给主要触控动作更大的有效点击区和间隔；窄卡片可把操作独立成一行，保留密集商品浏览。

**证据：** 尺寸源码确认；没有真实手机手势验收，不声称违反某项完整标准。 [product-card.tsx:343](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-card.tsx:343>)、[product-cart-quantity-control.tsx:81](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-cart-quantity-control.tsx:81>)

**验收：** 手机实际触控加减、删除、加购；焦点、禁用和错误反馈可辨，不能把截图当触控通过。

## 商品详情

<a id="detail-01"></a>

### DETAIL-01 [P2] 完整兼容型号被固定高度隐藏且无展开

**性质：** 内容裁切风险。

**现象与触发条件：** 兼容徽标区max-h-[58px]且overflow-hidden，所有型号都渲染进去，但超出两三行的型号无法查看。

**用户影响：** 详情本应是兼容性最终核对位置，多型号共享件却仍可能看不全，误选与客服询问增加。

**建议简化或修正：** 展示有限摘要并提供显示全部兼容型号；当前搜索匹配型号置前，真实品牌和兼容关系保持独立。

**证据：** 源码确认的长内容条件；本轮单型号实测商品未触发多行裁切。 [product-detail-page.tsx:156](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-page.tsx:156>)

**验收：** 长型号、多品牌共享件和十个以上型号可完整查看；不能改变已审核兼容数据。

<a id="detail-02"></a>

### DETAIL-02 [P3] 手机快速规格的正文被省略且缺少完整查看

**性质：** 已复现文字裁切。

**现象与触发条件：** 390商品图下方三列信息把Test pre-spedizione显示成Test pre-spe...；规格值用truncate，未提供展开或明确完整文本入口。

**用户影响：** 看到了标签但读不到含义；窄屏和长译文会扩大这个问题。

**建议简化或修正：** 允许规格正文换行，或改两列/列表；只对可理解的标识截断，不截断承诺与说明。

**证据：** 本轮线上390商品截图；product-390-it.jpg。 [product-detail-page.tsx:135](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-page.tsx:135>)、[product-detail-page.tsx:307](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-page.tsx:307>)

**验收：** 320/390中意，QC、包装和发票长文案全部可读；高度调整不会遮住购买入口。

<a id="detail-03"></a>

### DETAIL-03 [P2] 立即下单实际上会结算已有购物车的全部商品

**性质：** 操作语义风险。

**现象与触发条件：** Ordina ora调用addCurrentQuantityToCart后跳转统一checkout；购物车已有其他商品时也参与结算，没有独立的只买当前商品状态。已有当前SKU时按钮改为Vai al checkout，应保留。

**用户影响：** 用户可能以为只购买当前配件，到结账才发现其他暂存商品也在订单中。

**建议简化或修正：** 明确命名加入并结算购物车，并提示包含其他N款；如确需单品立即购买，建立独立受控购买意图。

**证据：** 源码调用链确认；本轮没有登录并创建订单。 [product-detail-purchase-panel.tsx:130](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-purchase-panel.tsx:130>)、[product-detail-purchase-panel.tsx:136](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-purchase-panel.tsx:136>)

**验收：** 空购物车、已有其他SKU、当前SKU已在车内、现货/预订各自核对；订单明细与按钮承诺一致。

<a id="detail-04"></a>

### DETAIL-04 [P3] 数量输入每次变更立即规范为至少1，难以暂时清空

**性质：** 数量输入优化。

**现象与触发条件：** number输入onChange把空字符串转成Number("")=0，updateQuantity立即回填至少1；输入直接绑定safeQuantity。

**用户影响：** 手机替换两位数数量时容易被强制回填干扰，用户需要全选而不是自然删除再输入。

**建议简化或修正：** 保留输入草稿，失焦/提交时再规范并校验MOQ和库存；加减按钮仍可即时处理。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [product-detail-purchase-panel.tsx:98](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-purchase-panel.tsx:98>)、[product-detail-purchase-panel.tsx:326](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/product-detail-purchase-panel.tsx:326>)

**验收：** 清空后输入、10改成2、粘贴小数/文字、MOQ和库存边界；不能因此放松后端数量校验。

## 登录注册

<a id="auth-01"></a>

### AUTH-01 [P3] 技术状态说明占据登录首屏的大块位置

**性质：** 信息层级优化。

**现象与触发条件：** 登录卡顶部显示Login Supabase attivo及账户/员工跳转技术说明；390下该块约145px，320验证码页仍先显示此块。

**用户影响：** 客户只想登录或输入验证码，却要先阅读实现细节，主要输入与注册按钮被推到更低位置。

**建议简化或修正：** 成功配置状态不作为客户主要内容；异常时只提供可操作的业务提示，配置细节留给运维。

**证据：** 本轮线上390登录与320验证码截图；login-390-it.jpg、verify-email-320-it.jpg。 [page.tsx:415](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:415>)

**验收：** 手机首屏可看到主要输入与动作；配置异常仍有明确恢复路径，不显示无用环境变量说明。

<a id="auth-02"></a>

### AUTH-02 [P3] 登录和注册两套邮箱密码表单直接堆在同一页

**性质：** 流程简化。

**现象与触发条件：** Google入口、登录Email/Password、注册Nome/Email/Password及专业申请链接全部纵向排列，存在重复字段名称。

**用户影响：** 新客户和老客户的主任务混在一起；手机要滚动到后方才能完成注册，容易填错表单。

**建议简化或修正：** 采用登录/创建账户明确切换，Google入口归属清楚；专业客户申请与基本账号建立关系写清。

**证据：** 本轮线上完整DOM与390截图；login-390-it.jpg。 [page.tsx:154](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:154>)、[page.tsx:262](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:262>)

**验收：** 老客户直接登录，新客户一步切注册，当前next目标和语言不丢；两表单字段语义可区分。

<a id="auth-03"></a>

### AUTH-03 [P2] 没有找回密码入口及恢复流程

**性质：** 账户恢复缺口。

**现象与触发条件：** 登录页只有密码登录、Google、注册和专业申请；本轮定向检索登录/Auth实现没有resetPassword/forgot入口。

**用户影响：** 忘记密码的既有客户无法自助恢复，容易重复注册或依赖人工客服。

**建议简化或修正：** 增加忘记密码、发送恢复邮件、设置新密码及返回目标的完整路径，遵守现有认证边界。

**证据：** 本轮线上控件确认＋定向源码检索；未发送恢复邮件或修改密码。 [page.tsx:204](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:204>)、[actions.ts:22](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/actions.ts:22>)

**验收：** 正常恢复、链接过期、重复使用、失败重试和语言均可操作；真实邮件/凭据修改须独立授权验收。

<a id="auth-04"></a>

### AUTH-04 [P3] 密码缺少可见性切换和提前的长度说明

**性质：** 输入体验优化。

**现象与触发条件：** 密码输入固定type=password；注册仅有minLength=8，长度提示主要在失败消息中，没有显示/隐藏控件。

**用户影响：** 手机容易输入错误，注册时到提交才知道长度不足。

**建议简化或修正：** 提供可访问的显示/隐藏按钮与简短长度规则，保留密码管理器autocomplete，不在日志中记录密码。

**证据：** 本轮线上表单控件＋源码；未输入真实密码。 [page.tsx:277](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:277>)、[page.tsx:281](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:281>)

**验收：** 键盘可切换可见性且不丢输入；长度规则、浏览器校验与服务端一致。

<a id="auth-05"></a>

### AUTH-05 [P2] 验证码验证与重发分别维护两份邮箱输入

**性质：** 重复输入与一致性风险。

**现象与触发条件：** verification-email和resend-email各自defaultValue=pendingEmail，修改上方邮箱不会同步下方；重发按钮也没有可见等待倒计时。

**用户影响：** 客户更正邮箱后可能仍把新验证码发往旧地址；重复点击后只得到限流错误，增加混乱。

**建议简化或修正：** 单一邮箱来源，验证与重发共用；提供显式更换邮箱和重发等待反馈，服务端限流继续保留。

**证据：** 本轮只读打开验证码模式并确认双邮箱；verify-email-390-it.jpg。未重发邮件。 [page.tsx:333](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:333>)、[page.tsx:371](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:371>)、[actions.ts:159](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/actions.ts:159>)

**验收：** 改邮箱后验证/重发目标一致；等待期间按钮有解释；错误和验证码输入保留。

<a id="auth-06"></a>

### AUTH-06 [P3] 认证失败后缺少明确的邮箱和姓名恢复策略

**性质：** 失败恢复优化。

**现象与触发条件：** 密码认证/注册失败redirect到loginUrl(next,error)，页面Email和Nome没有对应defaultValue或稳定草稿；密码出于保护可清空，但非秘密字段没有恢复。

**用户影响：** 如果重定向使表单重建或清空，客户需重新输入邮箱、姓名并找对应表单。浏览器/React是否自动保留未在本轮真实认证失败中实测，不能说每次失败必丢。

**建议简化或修正：** 失败时保留适当的非秘密输入，并把错误放在相关表单附近；密码不存入URL、日志或持久草稿。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [actions.ts:44](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/actions.ts:44>)、[actions.ts:100](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/actions.ts:100>)、[page.tsx:264](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/login/page.tsx:264>)

**验收：** 错误密码、已有邮箱、网络失败、验证码路径；非秘密字段可恢复，密码按明确策略处理。

<a id="auth-07"></a>

### AUTH-07 [P2] 个人中心和售后深链接登录后会丢掉目标参数

**性质：** 登录回跳缺口。

**现象与触发条件：** 未登录访问/account?section=orders实际变为/login?next=/account；RMA门禁也固定next=/rma，丢掉order/line/requestId。

**用户影响：** 通知里的订单或售后链接，在登录后无法直接回到该条记录；需重新选页签或订单。

**建议简化或修正：** 在安全校验下保留当前完整内部目的地址，登录后恢复页签、订单行和申请高亮。

**证据：** 本轮/account?section=orders回跳实测；RMA参数丢失为源码确认。 [page.tsx:36](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/account/page.tsx:36>)、[page.tsx:21](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/rma/page.tsx:21>)

**验收：** 匿名深链接→登录→精确目标；过期/不存在记录有解释；外部next和恶意URL继续拒绝。

## 专业客户申请

<a id="b2b-01"></a>

### B2B-01 [P3] 已有账户信息和浏览器自动填充未充分复用

**性质：** 重复输入优化。

**现象与触发条件：** 表单始终从空initialForm开始；initialAccountAccess仅传给Header，没有预填邮箱/姓名。大多数企业/电话/地址输入也没有autoComplete，电话未用tel。

**用户影响：** 已登录客户仍从头输入相同资料，手机键盘与系统自动填充无法明显减轻工作。

**建议简化或修正：** 从当前授权账户资料预填可复用字段并允许核对；为组织、邮箱、电话、地址加合适的autocomplete/inputMode。

**证据：** 源码确认；本轮匿名DOM证实13字段大多无自动填充标注，未登录查看预填行为。 [professional-application-page.tsx:71](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:71>)、[professional-application-page.tsx:181](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:181>)、[professional-application-page.tsx:287](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:287>)

**验收：** 已有账号预填正确且不跨账号；匿名为空；手机电话和地址输入方式合理。

<a id="b2b-02"></a>

### B2B-02 [P3] 必填可选字段没有清晰区分且全部铺开

**性质：** 表单分层优化。

**现象与触发条件：** 本轮表单有13个可编辑字段、7个required；标签不带必填标识。PEC、收件代码、网站、备注等和核心资料并排铺开，390页面高约2209px。

**用户影响：** 客户不清楚哪些可以跳过，可能花时间填写本可省略的内容，也容易漏必填。

**建议简化或修正：** 明确必填/可选；核心申请信息先完成，发票辅助字段和业务补充按需展开，不能删除后台真正要求的数据。

**证据：** 本轮DOM统计与截图；professional-390-it.jpg、browser-observations.json。 [professional-application-page.tsx:517](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:517>)、[professional-application-page.tsx:362](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:362>)

**验收：** 只填必要资料可完成表单校验；展开/收起不丢值；错误能定位具体字段。

<a id="b2b-03"></a>

### B2B-03 [P2] 申请地址与账户配送地址采用不同模型，容易重复填写

**性质：** 资料流程不一致。

**现象与触发条件：** 申请用Comune/Provincia和一个非必填Indirizzo，无独立CAP/门牌；个人中心又要求Provincia/Citta/CAP/Via/Numero并构造成完整地址。

**用户影响：** 申请时以为地址已交齐，进入下单前又需重新拆填；资料迁移不清楚时容易出错。

**建议简化或修正：** 明确申请只收企业所在地还是收完整地址；需要复用时采用相同地址组件/DTO并预填，减少第二次输入。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [professional-application-page.tsx:324](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:324>)、[account-page.tsx:1438](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1438>)、[account-page.tsx:1747](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1747>)

**验收：** 专业申请→账户资料→checkout地址一致；不完整的申请地址不能冒充可配送地址。

<a id="b2b-04"></a>

### B2B-04 [P2] 离开或刷新长申请表没有草稿保护

**性质：** 草稿丢失风险。

**现象与触发条件：** 13字段和同意选择只存在React state，未见脏输入离开提醒或应用层恢复机制；底部又有登录入口。重新挂载/刷新后缺少恢复，浏览器后退缓存是否暂时保留未实测。

**用户影响：** 填写途中误刷新或页面重新挂载后会重新开始；去登录往返也缺少可靠的应用层恢复保证，手机长表单损失明显。

**建议简化或修正：** 先增加脏输入离开提示；如保存草稿，按账户隔离、最小化信息和短期生命周期设计，不保存密码。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [professional-application-page.tsx:71](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:71>)、[professional-application-page.tsx:505](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:505>)

**验收：** 填一半去登录、关闭、刷新、取消离开；保留或明确确认丢弃，不能跨用户恢复资料。

<a id="b2b-05"></a>

### B2B-05 [P2] 发送申请缺少应用层超时和结果未知处理

**性质：** 等待恢复缺口。

**现象与触发条件：** POST b2b-applications未配置AbortController/等待超时，loading期间主按钮禁用；断连或响应迟迟不回时没有专门取消/核对路径。

**用户影响：** 客户可能一直等，或刷新重填并重复发送。应用层没有提供清楚的结果状态。

**建议简化或修正：** 提供有限等待和可核对的提交状态；结果未知时先查原申请，不仅提示再发。若允许重放，使用稳定请求标识。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [professional-application-page.tsx:126](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:126>)、[professional-application-page.tsx:429](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:429>)

**验收：** 请求拒绝、延迟、成功但响应丢失；输入保留，同一申请不会因为恢复流程重复创建。

<a id="b2b-06"></a>

### B2B-06 [P3] 申请成功缺少本次申请的可追踪结果

**性质：** 成功后流程优化。

**现象与触发条件：** 成功状态说明团队会邮件联系，随后清空全部资料和勾选；页面已有通用的审核/专业价格/账号使用说明和登录入口，但未显示本次申请编号、摘要或可查询状态，仍保留可重新提交的整套空表单。

**用户影响：** 客户知道通用审核步骤，但无法追踪自己这次提交、核对资料摘要或查看当前状态，可能重复申请或询问客服。

**建议简化或修正：** 成功后突出已提交摘要、申请编号/状态和账号下一步；如需修改或再申请，作为明确次级动作。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [professional-application-page.tsx:154](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:154>)、[professional-application-page.tsx:150](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/professional-application-page.tsx:150>)

**验收：** 首次提交成功后下一步明确；刷新和再次访问能在授权范围查询状态，不能展示他人申请。

## 购物车

<a id="cart-01"></a>

### CART-01 [P2] 清空和移除缺少撤销，操作会影响账号购物车

**性质：** 误操作恢复缺口。

**现象与触发条件：** Svuota carrello直接调用clearCart，底层setItems([])；移除商品也是立即修改，没有撤销区或确认摘要。

**用户影响：** 误触后多款SKU和数量需逐一重建；账号同步使刷新不能自然恢复原车。

**建议简化或修正：** 优先提供短时撤销和清楚的移除结果；整车清空可增加一次准确摘要确认，避免对每次数量加减增加确认。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [cart-page.tsx:629](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/cart-page.tsx:629>)、[cart-state.ts:172](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/cart-state.ts:172>)

**验收：** 清空/单项移除后可撤销；同步失败、切账号和并发更新时不恢复到错误账号或覆盖新数据。

<a id="cart-02"></a>

### CART-02 [P3] 缺少按多SKU与数量快速建车的入口

**性质：** B2B批量效率机会。

**现象与触发条件：** 当前主要依靠浏览目录逐项加购，再在购物车调整；没有批量粘贴SKU/数量或按历史采购清单准备购物车的前台入口。

**用户影响：** 维修店采购十几至几十款时，重复搜索和跳页消耗时间。此项是能力优化机会，不是现有逻辑故障。

**建议简化或修正：** 提供一个简单的SKU 数量批量输入/预览，逐条显示报价、MOQ、库存和未识别项；确认后按现有购物车契约写入。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [cart-page.tsx:185](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/cart-page.tsx:185>)、[store-header.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/store-header.tsx:120>)

**验收：** 已存在SKU、别名、重复行、无价、缺货、MOQ、现货/预订、角色权限；不能跳过权威报价或库存复核。

## 结账

<a id="check-01"></a>

### CHECK-01 [P1] 下单超时后引导重试而缺少同次提交防重

**性质：** 跨层结果未知风险。

**现象与触发条件：** 浏览器25秒AbortController中止后显示检查连接并重试；请求没有稳定requestId。API先创建订单，再清购物车、等待通知，最后响应；所核对最新仓库事务函数每次生成新订单，未见同次提交结果回放。

**用户影响：** 订单已创建但响应丢失时，用户可能再次提交，形成重复订单、库存预留或钱包扣款风险。价格/库存版本有时会阻挡重试，仍不能作为可靠防重。未证明线上已发生事故，未查询生产函数漂移。

**建议简化或修正：** 先把超时改为结果待确认并提供订单核对；完整修复使用同次提交的持久requestId、事务唯一约束、内容一致性检查和原结果回放，通知/清车失败不触发新建单。

**证据：** 主助手＋独立子助手定向跨层源码复核。没有制造生产超时、真实下单、扣款或写数据库。 [checkout-client.tsx:241](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:241>)、[checkout-client.tsx:868](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:868>)、[route.ts:127](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/orders/route.ts:127>)、[route.ts:433](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/orders/route.ts:433>)、[partspro-repository.ts:13282](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:13282>)、[20260927141646_account_pricing_authority.sql:23](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/supabase/migrations/20260927141646_account_pricing_authority.sql:23>)

**验收：** 隔离环境模拟事务成功但响应丢失/超过25秒；重复和并发同次请求只产生一个订单，库存、钱包、事件各一次；现货和预订单都覆盖。schema如需修改仍独立走migration批准。

<a id="check-02"></a>

### CHECK-02 [P2] 未登录结账同时铺出多种后续问题和可编辑表单

**性质：** 门禁与信息层级缺陷。

**现象与触发条件：** 匿名390结账显示Checkout禁用、客户资料缺失、购物车空三块警告，随后还有配送、支付、备注、确认和0欧底栏；资料提示甚至要求去客户管理。

**用户影响：** 用户还没登录就被告知多项无法处理的问题，也可能填写登录后不能保留的备注。

**建议简化或修正：** 按依赖顺序呈现：未登录只提供登录和返回购物车；登录后再显示对应资料/购物车问题。保持服务端所有校验。

**证据：** 本轮匿名线上实测和金额展开；checkout-anonymous-390-it.jpg。 [checkout-client.tsx:922](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:922>)、[checkout-client.tsx:944](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:944>)、[checkout-page.tsx:85](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-page.tsx:85>)

**验收：** 匿名、资料不全、空车、报价未就绪、正常下单各自只显示当前可解决的主要问题；不能因此让无权用户提交。

<a id="check-03"></a>

### CHECK-03 [P3] 已保存地址用只有一个选项的下拉框且缺少就近修改

**性质：** 无效步骤优化。

**现象与触发条件：** 有地址时Select固定saved-shipping-address，内容也只有同一个选项；缺地址时有完善资料链接，有地址但需更正时没有就近编辑入口。

**用户影响：** 打开下拉并不能选择其他地址；更改配送目的地要自行找个人中心。

**建议简化或修正：** 单地址直接显示摘要＋编辑；真正多地址时才使用选择器，并解释账单与收货地址的关系。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [checkout-client.tsx:1593](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1593>)、[checkout-client.tsx:1599](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1599>)

**验收：** 单地址不产生无意义选择；修改/新增成功后原结账继续，身份和报价重新验证。

<a id="check-04"></a>

### CHECK-04 [P2] 去补资料或回购物车后缺少结账草稿恢复

**性质：** 往返恢复缺口。

**现象与触发条件：** 完善资料链接是/account?setup=1，没有returnTo；配送、支付、备注和确认位于initialFormState/React state。页面重新挂载/刷新后没有对应应用层草稿恢复机制；本轮未实测真实登录往返，浏览器后退是否暂时保留状态不作确定结论。

**用户影响：** 补地址或改数量需要离开结账；页面重新挂载时需重选配送/支付、重写备注，缺少稳定的继续原任务路径。不是断言每次浏览器返回都必然丢失。

**建议简化或修正：** 从结账原位打开资料或带安全返回目标；按账号/客户上下文保存非秘密草稿。恢复后重新报价，价格改变时重新确认。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [checkout-client.tsx:1612](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1612>)、[checkout-client.tsx:2631](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:2631>)、[checkout-client.tsx:908](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:908>)

**验收：** 结账→改资料/改数量→返回，分别验证路由重新挂载、浏览器后退和刷新，输入可靠恢复；切换客户/账号不串单；旧确认不能覆盖新金额。

<a id="check-05"></a>

### CHECK-05 [P2] 手机隐藏付款方式的关键说明

**性质：** 手机信息缺失。

**现象与触发条件：** PaymentSection的description使用hidden sm:block；手机仅看Bonifico bancario/Contanti，桌面才说明前者待付款、后者在店收款。

**用户影响：** 客户可能不清楚选现金意味着何时何地付款，之后需要人工解释或调整。

**建议简化或修正：** 手机也显示一句简短说明，尤其现金收款方式；支付限制与配送选择的组合由现有业务规则确认。

**证据：** 本轮手机付款DOM与源码确认；没有选择真实订单付款。 [checkout-client.tsx:1688](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1688>)、[checkout-client.tsx:1735](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1735>)

**验收：** 390/320可读出每种支付的下一步；预订单禁用现金的原因可见，不擅自改支付契约。

<a id="check-06"></a>

### CHECK-06 [P3] 隐藏的配送和付款单选缺少明显的焦点状态

**性质：** 键盘交互风险。

**现象与触发条件：** radio采用sr-only，外层label按选中状态变色，但未见focus-within/has-focus-visible焦点样式。

**用户影响：** 键盘可以进入单选，却可能难以看见焦点在哪；选中状态不能替代焦点状态。

**建议简化或修正：** 为整个选择卡片提供明确可见焦点，保留原生radio分组键盘行为。

**证据：** 源码风险确认；本轮未做完整键盘遍历。 [checkout-client.tsx:1638](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1638>)、[checkout-client.tsx:1725](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/checkout-client.tsx:1725>)

**验收：** Tab/方向键选择配送与支付，焦点和选中可区分，禁用预订付款仍正确；需目标浏览器实测。

## 个人中心

<a id="account-01"></a>

### ACCOUNT-01 [P2] 订单历史最多读200条且无搜索分页说明

**性质：** 查找与范围缺口。

**现象与触发条件：** readCustomerOrderRows默认limit=200，OrdersSection对收到的数组做状态过滤，显示filteredOrders.length/orderSummaries.length；没有订单号、日期搜索或继续读取入口。

**用户影响：** 老客户找更早订单可能找不到，数量看起来像全部历史；查一单需逐条浏览。

**建议简化或修正：** 提供订单号/日期的服务端查询、分页和总数；标明已加载范围，通知深链接可独立查该订单。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [partspro-repository.ts:12351](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:12351>)、[account-page.tsx:761](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:761>)、[account-page.tsx:764](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:764>)

**验收：** 超过200单、状态过滤、早期订单和通知指定单都能找到；客户只能读自己的订单。

<a id="account-02"></a>

### ACCOUNT-02 [P2] 钱包只展示最近8笔且无法查看完整或关联订单

**性质：** 资金可解释性缺口。

**现象与触发条件：** WalletSection把transactions.slice(0,8)，只显示原因、日期和金额，没有查看全部、筛选或关联订单/售后链接。

**用户影响：** 客户不能自助核对较早退款和抵扣来源，往往只能询问客服。

**建议简化或修正：** 保留最近8笔摘要，另给完整流水和来源详情；余额、借贷方向、退款/消费引用保持一致。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [account-page.tsx:678](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:678>)、[account-page.tsx:585](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:585>)

**验收：** 超过8笔、退款、抵扣及更正记录可查；流水和关联单据权限一致，数据失败不当成0余额。

<a id="account-03"></a>

### ACCOUNT-03 [P2] 快速关闭再打开另一订单会被旧详情响应覆盖

**性质：** 请求竞态风险。

**现象与触发条件：** openOrderDetail每次直接fetch并写共享detail/error/loading，关闭Dialog只改open。A开始读取→关闭→打开B→B先返回→A后返回时，A可能覆盖B。

**用户影响：** 正在查看的订单内容、错误或loading可能属于另一单，影响核对和后续操作判断。

**建议简化或修正：** 复用最新请求序列/取消保护；关闭或切单后，旧请求不能更新detail、error、loading。

**证据：** 主助手＋独立子助手静态竞态复核；本轮没有登录后的浏览器复现。 [account-page.tsx:236](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:236>)、[account-page.tsx:360](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:360>)

**验收：** A慢成功/慢失败、B仍加载、关闭后晚响应等可控次序；当前详情始终绑定当前订单。

<a id="account-04"></a>

### ACCOUNT-04 [P2] 资料弹层未保存和保存中都缺少统一关闭保护

**性质：** 草稿与关闭保护缺口。

**现象与触发条件：** Dialog的onOpenChange直接外传；关闭后重新打开会重设表单。保存时取消按钮disabled，但ESC、遮罩和公共关闭按钮未统一守卫。

**用户影响：** 填写长地址后误关会丢输入；保存仍在进行时退出，成功/失败反馈可能不可见。

**建议简化或修正：** 统一拦截关闭入口；有脏输入时确认丢弃，保存中锁定关闭或安全呈现进行状态；失败保留输入。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [account-page.tsx:1187](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1187>)、[account-page.tsx:1210](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1210>)、[account-page.tsx:1310](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1310>)

**验收：** 取消、X、ESC、遮罩、浏览器返回、保存成功/失败/等待各路径；取消不产生新的写请求。

<a id="account-05"></a>

### ACCOUNT-05 [P2] 补全资料后的权限说明前后不一致

**性质：** 业务文案矛盾。

**现象与触发条件：** 资料提醒说补全后系统启用零售价并可下单；资料弹层又说保存后保持审核直到管理员分配类型/等级。

**用户影响：** 客户不清楚保存后立即可用还是要等待审核，可能反复联系客服或重复提交。

**建议简化或修正：** 以当前服务端账户状态契约为准，统一零售启用、批发申请、待分配、暂停账号各状态和下一步。

**证据：** 两段发布源码直接矛盾；实际服务端状态变更未在本轮写入验证。 [account-page.tsx:1165](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1165>)、[account-page.tsx:1402](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:1402>)

**验收：** 新注册补全、已零售、待批发、暂停账户分别核对；展示与实际价格/购物车/checkout门禁一致。

<a id="account-06"></a>

### ACCOUNT-06 [P3] 订单详情读失败只能关闭重开，没有原位重试

**性质：** 失败恢复优化。

**现象与触发条件：** AccountOrderDetailPanel的error分支只渲染红色文字，不提供retry；重新读取依赖回列表再次打开。

**用户影响：** 短暂网络错误也要走关闭→找同一单→重新打开，多一次定位。

**建议简化或修正：** 在原位提供重试并保留当前订单身份；配合请求竞态保护，避免重试读错单。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [account-page.tsx:392](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:392>)、[account-page.tsx:410](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:410>)

**验收：** 模拟失败后一次点击重试恢复同一订单；错误、空、权限拒绝分别说明。

<a id="account-07"></a>

### ACCOUNT-07 [P2] 订单详情未展示API已经提供的物流与追踪信息

**性质：** 前后端展示遗漏。

**现象与触发条件：** 账户订单API返回toAdminOrderDto，其中含carrier/tracking/service/shippingAddress；账户详情本地类型和渲染主要只有状态、付款、金额、商品行和操作记录，没有物流字段区。

**用户影响：** 客户知道已发货却不能就近看到运单号/承运商，增加查件客服工作。

**建议简化或修正：** 使用适合客户的精简DTO展示物流、收货地址和追踪动作；不要为显示物流把员工内部字段全部暴露到UI。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [route.ts:45](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/account/orders/[orderId]/route.ts:45>)、[_dto.ts:99](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/orders/_dto.ts:99>)、[account-page.tsx:101](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:101>)

**验收：** 未发货、已发货、无单号、已送达等状态清楚；追踪信息与当前订单一致，内部信息不扩散。

## 客户售后

<a id="rma-c-01"></a>

### RMA-C-01 [P3] 待选订单和商品全部铺成卡片，没有检索

**性质：** 查找效率优化。

**现象与触发条件：** 未选订单时直接orderOptions.map卡片，选订单后selectedOrder.lines.map全列；没有订单号、SKU或日期的查询入口。单行自动选中已有，应保留。

**用户影响：** 采购频繁或多SKU订单时，光定位退货配件就需大量滚动。

**建议简化或修正：** 增加订单号/日期和订单内SKU检索；保留通知/订单行预选，避免要求再手填完整编号。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [rma-page.tsx:839](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:839>)、[rma-page.tsx:783](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:783>)

**验收：** 几十个可售后订单及大订单内查指定SKU；查询不改变可退数量和有效期。

<a id="rma-c-02"></a>

### RMA-C-02 [P2] 个人中心打开已有申请却跳到新申请表顶部

**性质：** 上下文跳转缺口。

**现象与触发条件：** ServiceSection每条已有售后的打开href都为/rma，没有requestId；RMA页面新申请表在前、最近申请在后。RMA自身已有initialRequestId滚动定位能力，但该入口未使用。

**用户影响：** 想看已有申请进度却先看到新建表，再往下找原申请，多次定位且可能误开新申请。

**建议简化或修正：** 已有记录入口传requestId并定位/展开该卡；按进入目的区分新申请和我的申请，直接复用现有定位功能。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [account-page.tsx:941](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/account-page.tsx:941>)、[rma-page.tsx:198](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:198>)、[rma-page.tsx:1074](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:1074>)

**验收：** 从每条申请打开能落到对应记录，登录回跳也保留requestId；找不到记录时有解释。

<a id="rma-c-03"></a>

### RMA-C-03 [P2] 售后数据读取失败后没有专用重试且容易出现无订单提示

**性质：** 读取失败恢复缺口。

**现象与触发条件：** loadRmaData catch只设dataError；表单显示警告，orderOptions空时仍走无可售后订单的EmptyBox，没有绑定该GET的重试按钮。提交上传重试机制已存在，不能混为缺失。

**用户影响：** 服务暂不可读时，客户可能误以为自己没有售后资格，刷新又可能丢输入。

**建议简化或修正：** 读取错误与确实没有可退商品分开呈现；提供原位重读，保留输入并重新核对当前可退数量。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [rma-page.tsx:242](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:242>)、[rma-page.tsx:278](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:278>)、[rma-page.tsx:835](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:835>)

**验收：** GET失败→重试恢复、真实空、权限拒绝、旧数据已加载后失败，四种情况均清楚区分。

<a id="rma-c-04"></a>

### RMA-C-04 [P2] 照片与上传恢复状态只在内存，刷新会丢当前进度

**性质：** 页面生命周期恢复风险。

**现象与触发条件：** images、form、uploadCheckpoint和两类幂等键保存在state/ref，未见离开提醒或跨刷新持久恢复。当前页内已有照片验证、幂等提交、重试/清理和已提交恢复，应保留。

**用户影响：** 上传途中误刷新可能失去照片选择和原恢复标识，需重新定位申请或重选照片；不能把当前页内可靠重试等同于刷新恢复。

**建议简化或修正：** 先加脏输入/上传中离开保护；按安全边界保留最小草稿ID与状态，并向服务端核对是否已提交。原始照片持久化需另行评估，不能把照片写入普通日志。

**证据：** 发布基准源码生命周期风险；本轮未登录、未上传真实照片或制造中断。 [rma-page.tsx:227](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:227>)、[rma-page.tsx:221](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:221>)、[rma-page.tsx:306](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/rma-page.tsx:306>)、[partspro-rma-upload-client.mjs:42](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-rma-upload-client.mjs:42>)

**验收：** 刷新前未提交、上传中、最终提交成功但响应丢失、清理中和换账号；只恢复当前账户草稿，不重复申请。

## 客户客服

<a id="chat-c-01"></a>

### CHAT-C-01 [P2] 关闭客服窗口会丢掉未发送文字

**性质：** 草稿丢失风险。

**现象与触发条件：** SupportChatPanel的draft是组件state；SupportWidget关窗后把面板卸载，重开会从空文本开始。

**用户影响：** 客户查订单或产品时临时关窗，再回来要重写长问题描述。

**建议简化或修正：** 在父级按当前账户/会话保留草稿，或关闭时提醒；账户切换及时清理，草稿不串客户。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [support-chat-panel.tsx:95](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-chat-panel.tsx:95>)、[support-widget.tsx:86](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-widget.tsx:86>)

**验收：** 输入→关闭→重开、页面导航、账户切换和发送失败；未发送文本恢复且不发送给错误对象。

<a id="chat-c-02"></a>

### CHAT-C-02 [P3] 客服面板缺少明确的打开焦点与关闭返回

**性质：** 键盘可达性优化。

**现象与触发条件：** 面板是固定section，没有对话框角色、打开时焦点转移或Escape关闭/焦点恢复代码；关闭按钮名称还固定英文。非模态客服不一定需要锁背景，但需要清楚的键盘路径。

**用户影响：** 键盘用户打开后可能仍在页面按钮上，必须继续Tab寻找输入；关闭后不清楚焦点回哪里。

**建议简化或修正：** 定义非模态dialog语义、打开时合理聚焦、Escape关闭与触发器焦点恢复；关闭名称随语言。

**证据：** 源码确认的键盘路径风险；本轮未完成登录客服的读屏/键盘验收。 [support-chat-panel.tsx:149](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-chat-panel.tsx:149>)、[support-chat-panel.tsx:275](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-chat-panel.tsx:275>)

**验收：** 纯键盘打开、编辑、关闭和恢复焦点；不把背景全锁作为唯一方案；读屏能理解面板范围。

<a id="chat-c-03"></a>

### CHAT-C-03 [P2] 客服模块加载时关闭按钮被禁用

**性质：** 加载恢复缺口。

**现象与触发条件：** dynamic加载SupportChatPanel时使用SupportChatPanelLoading；fallback的X disabled，也没有通过props调用外部onClose。

**用户影响：** 模块下载慢或失败时，客户不能在该窗口直接关闭加载状态，只能等或离开页面。

**建议简化或修正：** 加载面板也接收有效关闭回调；模块失败有重试和关闭，不能为加载而禁用退出。

**证据：** 发布基准源码确认；本轮未在登录业务环境复现。 [support-widget.tsx:105](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-widget.tsx:105>)、[support-widget.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/support-widget.tsx:120>)

**验收：** 模拟模块下载延迟/失败，X和Escape可关闭，重开可重试，背景主任务可继续。

## 后台64项索引

以下64项复用项目内既有详细报告，关键金额、客服对象、财务页签、侧栏与eBay草稿已重新核对。主目录已有部分候选、全面修复仍在另一个任务进行；此表不表示64项在本轮全部重新实测，更不表示它们已经修复或上线。

| ID | 优先级 | 问题 |
|---|---|---|
| [G-01](#g-01) | P2 | 顶部全局搜索框没有搜索行为 |
| [G-02](#g-02) | P2 | 短屏桌面侧栏的账号区覆盖底部菜单 |
| [G-03](#g-03) | P2 | 营销入口实际进入运营时间线 |
| [G-04](#g-04) | P2 | 网站统计入口长期可见但始终禁用 |
| [G-05](#g-05) | P3 | 底部账号卡像下拉菜单但没有操作 |
| [G-06](#g-06) | P3 | 侧栏默认折叠且不保存用户选择 |
| [G-07](#g-07) | P2 | 跨模块返回缺少稳定的筛选、页码和选中上下文 |
| [G-08](#g-08) | P3 | 顶栏始终写运营后台，没有当前位置 |
| [G-09](#g-09) | P3 | 部分可见字段标签未与输入控件关联 |
| [H-01](#h-01) | P2 | 总览的大数字依赖100条样本，容易被当成全站统计 |
| [H-02](#h-02) | P3 | 30/90天图表与旁边7日指标混在一个区块 |
| [H-03](#h-03) | P3 | 预警和管道给出结果，却缺少直接处理入口 |
| [O-01](#o-01) | P2 | 付款、运费、缺货保存先关闭表单，失败后难以继续原输入 |
| [O-02](#o-02) | P2 | 已保存但详情刷新失败，会被统一报告为操作失败 |
| [O-03](#o-03) | P2 | 列表快捷状态操作忽略当前权限，与详情内权限行为不一致 |
| [O-04](#o-04) | P2 | 查指定订单要逐页找，已有搜索/日期/客户/排序接口未暴露到 UI |
| [O-05](#o-05) | P3 | 日常打印/处理只能逐单打开，缺少批量准备入口 |
| [O-06](#o-06) | P2 | 缺货登记关键流程写死中文，意大利语页面仍无法读懂 |
| [O-07](#o-07) | P3 | 手机操作阶段和待办筛选横向隐藏，缺少提示 |
| [P-01](#p-01) | P3 | 商品下的五个工作区跨了多种日常任务 |
| [P-02](#p-02) | P3 | 商品详情六页签采用660px隐藏滚动条 |
| [P-03](#p-03) | P2 | Excel导入关闭会直接清空文件、粘贴和预览 |
| [P-04](#p-04) | P2 | 导入预览只显示部分字段名，缺少完整旧值→新值 |
| [P-05](#p-05) | P2 | 商品审计每条只显示前6个变化，没有展开 |
| [P-06](#p-06) | P3 | 目录排序需逐项输数字，手机编辑区在列表后方 |
| [P-07](#p-07) | P3 | 批次详情在小平板就启用1180px宽表格 |
| [P-08](#p-08) | P3 | 商品编辑的兼容性提示直接显示内部规则码 |
| [I-01](#i-01) | P2 | 缺货和补货队列最多50条，导出也只用当前数组 |
| [I-02](#i-02) | P2 | 库存体检只展示前8项，没有查看全部问题入口 |
| [I-03](#i-03) | P3 | 补货计划主要逐行加入、修改和保存 |
| [R-02](#r-02) | P2 | 售后每个队列固定前80条，缺少继续浏览入口 |
| [R-03](#r-03) | P2 | 售后详情缺少客户原始故障原因和原始描述 |
| [R-07](#r-07) | P3 | 手机六阶段栏的后半段缺少可发现的入口 |
| [R-08](#r-08) | P3 | 手机空队列仍保留大块空白详情占位 |
| [A-01](#a-01) | P2 | 账号编辑对话框关闭直接销毁草稿，提交中也没有关闭拦截 |
| [A-02](#a-02) | P2 | 想修一个电话也必须先补全整份档案，表单未按任务拆分 |
| [A-03](#a-03) | P2 | 有效权限只展示前 24 个，+N 无展开动作 |
| [A-04](#a-04) | P2 | 员工角色调整只选名称，缺少权限变化预览 |
| [A-05](#a-05) | P2 | “历史订单”实际只取最近 20 条，还没有进入订单处理的链接 |
| [A-06](#a-06) | P2 | 账号面板主要操作和反馈写死中文，当前 i18n 只覆盖少量角色标签 |
| [F-01](#f-01) | P1 | 财务逗号小数输入会发出null，API金额校验可将其转换为0 |
| [F-02](#f-02) | P2 | 付款时间默认取 UTC 文本，再作为本地时间提交，罗马时区偏移 |
| [F-03](#f-03) | P2 | 记供应商付款时，批次下拉受报表筛选控制 |
| [F-04](#f-04) | P2 | 财务明细固定取默认 50 条，没有分页或总数说明 |
| [F-05](#f-05) | P2 | 记错费用/付款后页面没有修正入口，已有 PATCH 接口未接入 |
| [F-06](#f-06) | P2 | 错误被替换为泛化消息，明细失败又渲染“无数据” |
| [F-07](#f-07) | P2 | 财务只读员工仍看到新增费用/付款按钮 |
| [F-08](#f-08) | P2 | 手机财务多行页签高度没有撑开，覆盖下方卡片 |
| [E-01](#e-01) | P2 | eBay未保存设置时也可以生成计划，后续刷新会覆盖草稿 |
| [E-02](#e-02) | P2 | eBay缺少连接和就绪的逐步引导 |
| [E-03](#e-03) | P3 | eBay手机四张统计卡占满首屏 |
| [E-04](#e-04) | P3 | eBay映射在手机仍是多列可编辑宽表 |
| [E-05](#e-05) | P2 | 执行队列一次只处理5条，缺少继续处理的明确路径 |
| [E-06](#e-06) | P2 | eBay整页主要写死中文和技术英文 |
| [S-01](#s-01) | P1 | 回复草稿跨会话保留，可能发送给另一客户 |
| [S-02](#s-02) | P2 | 客服队列固定50/100条，没有搜索和翻页 |
| [S-03](#s-03) | P2 | 切换会话读取失败时，旧详情仍留在回复区域 |
| [M-01](#m-01) | P2 | 活动时间线没有接入真实活动源 |
| [M-02](#m-02) | P3 | 手机隐藏了本地备注的说明，刷新会丢便签 |
| [T-01](#t-01) | P2 | 权限矩阵点一次就立即生效，缺少变更差异核对 |
| [T-02](#t-02) | P3 | 后台设置外层中文，内部权限页却随语言切换 |
| [T-03](#t-03) | P3 | 手机员工列表用大块最小高度，少量员工时空白很大 |
| [X-01](#x-01) | P3 | REMAX后台从总览快捷链接进入，缺统一模块导航和语言 |
| [X-02](#x-02) | P2 | REMAX待处理预订单只列前8条，没有查看全部入口 |

## 后台全部问题明细

以下明细整合自 [后台操作与UI审查原报告](2026-10-10-admin-panel-operation-ui-audit.md)。其中浏览器复现与线上观察属于该既有审查；本轮只做定向复核。P-06的手机编辑器已有自动滚动，保留排序效率建议，不能理解为必须手动寻找；P-07是宽表长内容候选；G-04区分发布禁用与主目录已接入候选。
## 通用导航

<a id="g-01"></a>

### G-01 [P2] 顶部全局搜索框没有搜索行为

**现象：** 顶部输入框写着搜索订单、SKU、客户，但没有value/onChange、提交处理或结果区；和页面内搜索并存。

**操作影响：** 员工在最显眼的入口输入后无法查到内容，尤其订单页本身又缺查询控件。

**建议简化/修正：** 接入统一搜索，分订单/商品/客户显示匹配结果并直达详情；交付前移除可输入但无行为的状态。

**证据：** 线上控件可见 + 发布源码确认。 [admin-dashboard.tsx:781](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:781>)

**验收：** 输入订单号、SKU、客户关键字能分别定位；无匹配、加载、失败有明确反馈。

<a id="g-02"></a>

### G-02 [P2] 短屏桌面侧栏的账号区覆盖底部菜单

**现象：** 侧栏固定h-screen，导航没有自身滚动，账号卡absolute bottom-4。线上1280×568中账号区y=483–552，财务y=480–520、统计y=524–564，设置y=568–608。合成组件也复现统计/设置与底部卡重叠。

**操作影响：** 浏览器窗口较矮或缩放后，菜单被遮挡或落到视口外；这是既有后台审查明确复现的实际遮挡。

**建议简化/修正：** 侧栏改成顶部品牌、可滚动导航、底部账号三个flex区域；底部卡不要覆盖导航流。

**证据：** 线上几何读取与截图 + 合成组件复现。 [admin-dashboard.tsx:560](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:560>)、[admin-dashboard.tsx:675](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:675>)

**验收：** 1280×568、1280×720及展开/折叠两状态，所有菜单均可滚动到并点击，账号区无覆盖。

<a id="g-03"></a>

### G-03 [P2] 营销入口实际进入运营时间线

**现象：** 导航营销对应timeline，内容是后台活动时间线和本地备注。

**操作影响：** 想找促销、活动、客户触达的人进入了日志页，查操作记录的人又不会自然选择营销。

**建议简化/修正：** 将入口改名为活动记录/运营日志；真实营销功能有明确范围时独立进入。

**证据：** 线上入口与发布源码一致。 [admin-dashboard.tsx:97](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:97>)、[admin-activity-timeline.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:120>)

**验收：** 菜单名称、标题和实际主任务一致。

<a id="g-04"></a>

### G-04 [P2] 网站统计入口长期可见但始终禁用

**现象：** 发布基准navItems中的reports没有panel；可用性依赖panel，因此按钮禁用。正式Dashboard也没有analytics的TabsContent。主目录有后续统计候选，不能代表正式入口已接入。

**操作影响：** 用户无法知道是没权限、未连接还是功能未上线，反复尝试无意义。

**建议简化/修正：** 接入已具备权限和数据的统计页面；尚未接入时显示明确未开放说明或隐藏入口。

**证据：** 线上disabled状态 + 发布源码确认。 [admin-dashboard.tsx:99](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:99>)、[admin-dashboard.tsx:459](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:459>)

**验收：** 有权限账号能够进入；无权限与未配置分别解释。

<a id="g-05"></a>

### G-05 [P3] 底部账号卡像下拉菜单但没有操作

**现象：** 卡片显示固定Admin/管理员及ChevronDown，实际只是div，身份也未使用当前账号信息。

**操作影响：** 视觉上暗示可以展开账号操作，点击无反应；员工无法从此确认当前身份。

**建议简化/修正：** 使用当前账号名称与角色；需要展开就接真实账号菜单，纯身份展示则去掉下拉箭头。

**证据：** 发布源码确认。 [admin-dashboard.tsx:537](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:537>)

**验收：** 卡片交互、箭头和键盘语义一致；展示当前身份。

<a id="g-06"></a>

### G-06 [P3] 侧栏默认折叠且不保存用户选择

**现象：** 折叠状态每次初始化为true，展开/收起没有持久化；折叠仅靠图标和悬停提示。

**操作影响：** 新员工要反复辨认图标；刷新或重新进入后又需展开。

**建议简化/修正：** 默认按设备宽度/首次使用展示适当状态，保存个人展开偏好，首次保留名称更容易学习。

**证据：** 发布源码确认。 [admin-dashboard.tsx:277](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:277>)

**验收：** 刷新后保持用户选择；首次用户能辨认各业务入口。

<a id="g-07"></a>

### G-07 [P2] 跨模块返回缺少稳定的筛选、页码和选中上下文

**现象：** 一级切换用router.replace；TabsContent按活动页装卸载，各列表主要把筛选和页码保存在组件state，商品URL只同步workspace/sku等局部信息。

**操作影响：** 从客户到订单、从缺货到商品后难回到原位置；浏览器返回不形成逐页处理路径。

**建议简化/修正：** 把可恢复查询状态存URL/会话，提供带来源的返回；关键定位用push，筛选内部才按需要replace。

**证据：** 发布源码确认；跨模块完整真实账号流程未逐项复验。 [admin-dashboard.tsx:381](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:381>)、[admin-dashboard.tsx:463](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:463>)、[admin-products-panel.tsx:1806](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:1806>)

**验收：** 筛选第3页→详情/别模块→返回，筛选、页码、选择和滚动位置恢复。

<a id="g-08"></a>

### G-08 [P3] 顶栏始终写运营后台，没有当前位置

**现象：** activePanel传给Topbar用于菜单，但标题始终使用固定text.topbar.title/subtitle；主要模块依赖内容区标题再次说明。

**操作影响：** 收起侧栏或长页滚动时，不容易判断当前模块及来源。

**建议简化/修正：** 顶栏增加当前模块/子页名称和简短返回路径，固定宣传副标题缩减。

**证据：** 线上多页观察 + 发布源码确认。 [admin-dashboard.tsx:769](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:769>)

**验收：** 长页滚动与手机菜单关闭后仍能知道当前模块。

<a id="g-09"></a>

### G-09 [P3] 部分可见字段标签未与输入控件关联

**现象：** 财务多处Label没有htmlFor且输入没有id；eBay和REMAX的Field也把Label与输入作为相邻元素。

**操作影响：** 点击标签不能聚焦输入，屏幕阅读器难以辨识；密集表单里更易填错相邻字段。

**建议简化/修正：** 统一Field生成id/htmlFor或明确aria-labelledby；图标操作补aria-label，不能只用title。

**证据：** 发布源码确认；财务模拟界面已查看。 [admin-finance-panel.tsx:701](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:701>)、[admin-marketplace-panel.tsx:999](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:999>)、[admin-remax-center.tsx:460](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:460>)

**验收：** 标签点击聚焦对应字段；键盘/读屏能读出金额、IVA、政策ID等名称。

## 总览

<a id="h-01"></a>

### H-01 [P2] 总览的大数字依赖100条样本，容易被当成全站统计

**现象：** overview API只读取最近100单和最近更新100商品再聚合。线上标题小字有100/185、100/17976等范围，大卡片仍叫库存预警/活跃SKU/待收款；数值不是完整库存与订单总量。

**操作影响：** 补货和经营判断可能基于有限样本；长期间趋势也可能缺早期订单。

**建议简化/修正：** 全站KPI用服务端完整聚合；暂用样本时每张卡显著标注样本统计、覆盖时间和范围，并链接完整清单。

**证据：** 线上范围提示 + 发布API/聚合源码确认，未读数据库全量进行对账。 [route.ts:95](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/overview/route.ts:95>)、[route.ts:121](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/overview/route.ts:121>)、[admin-overview-dashboard.tsx:162](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:162>)

**验收：** 超过100条合成订单/商品时，全局KPI与完整聚合一致；样本指标清楚单列。

<a id="h-02"></a>

### H-02 [P3] 30/90天图表与旁边7日指标混在一个区块

**现象：** 趋势下拉有7/30/90天，旁边MiniKpi仍固定sales7d/paidOrders7d/averageOrder7d。标签确实写7日，数值本身未被证明错误。

**操作影响：** 同一区块切换30天后仍展示7日小计，容易误以为筛选同时作用于旁边金额。

**建议简化/修正：** 把旁边KPI改为当前图表期间，或明显分开固定7日指标并说明控件范围。

**证据：** 发布源码确认；属于信息组织优化。 [admin-overview-dashboard.tsx:412](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:412>)、[admin-overview-dashboard.tsx:425](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:425>)

**验收：** 切换30/90天后数据口径和文案清楚。

<a id="h-03"></a>

### H-03 [P3] 预警和管道给出结果，却缺少直接处理入口

**现象：** 热门库存预警、订单管道主要显示卡片/状态汇总，主要快捷处理只有处理订单、查看商品和时间线。

**操作影响：** 看见具体缺货SKU或某阶段数量后仍需去列表再定位。

**建议简化/修正：** 具体预警链接到该SKU/补货；阶段数量直达预筛选订单列表，保留来源返回。

**证据：** 发布源码确认 + 总览线上观察。 [admin-overview-dashboard.tsx:447](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:447>)、[admin-overview-dashboard.tsx:606](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:606>)

**验收：** 任一预警/阶段可一步进入对应范围。

## 订单

<a id="o-01"></a>

### O-01 [P2] 付款、运费、缺货保存先关闭表单，失败后难以继续原输入

**现象：** 付款提交调用 void 回调后立即 `setDialogOpen(false)`；运费同样立即关闭；缺货提交后将 `editingLine` 清空。付款/运费重新打开会从旧订单数据重新初始化草稿；缺货重新打开也重置原因。员工备注保存也在请求结果前退出编辑。

**操作影响：** 网络/校验失败后用户只见面板层错误，须重新找到编辑入口并重填；付款、运费和缺货都是需要仔细核对的输入。

**建议简化/修正：** 保存回调返回结果，保持对话框与输入至保存成功；失败信息放在表单内，并可在原字段直接更正。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:3558](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:3558>)

**验收：** 模拟 400、403、超时，输入、当前订单和焦点均保留；成功时关闭。

<a id="o-02"></a>

### O-02 [P2] 已保存但详情刷新失败，会被统一报告为操作失败

**现象：** PATCH 成功并 upsert 返回订单后，还在同一个 try 内等待详情 GET；GET 失败进入同一 catch，展示 rejected/error。

**操作影响：** 员工不知道是否已保存，容易重复操作，尤其对收款核对和退款类金额操作不利。

**建议简化/修正：** 分别报告“保存已完成”和“详情刷新失败”；仅提供重读按钮，保留已返回状态，并避免让用户重新提交。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:842](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:842>)

**验收：** 成功写入后只读刷新失败不会显示“保存失败”，也不会丢掉返回记录。

<a id="o-03"></a>

### O-03 [P2] 列表快捷状态操作忽略当前权限，与详情内权限行为不一致

**现象：** OrdersList props 没有权限参数，依据订单状态生成 transition，按钮只检查 isMutating；handleQuickTransition/handleTransition 没有 orders.manage 检查。详情却明确计算并使用 orders.manage。

**操作影响：** 只读员工在列表看到可操作按钮，点击后才被服务器拒绝，既浪费操作也降低对权限的理解。

**建议简化/修正：** 列表使用相同 capability，只读账号显示详情；有状态但无权限时说明需要哪项权限。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:1796](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1796>)

**验收：** 只读角色列表无可点击写入快捷动作，详情与列表一致。

<a id="o-04"></a>

### O-04 [P2] 查指定订单要逐页找，已有搜索/日期/客户/排序接口未暴露到 UI

**现象：** 面板只有订单/收款/配送视图和工作流筛选，没有订单号/客户文本搜索、日期范围或排序控件；fetchOrders 固定 `sort=operations_queue`，未接 q、customerId、dateFrom/dateTo。分页只有上一页/下一页。

**操作影响：** 客服按客户电话/订单号追查、查某天收款或旧订单，需要多次翻页；当前工作队列排序不适合所有查询目的。

**建议简化/修正：** 一行提供订单号/客户搜索和日期，排序放“更多筛选”；显示活动筛选并可一键清除；保留当前工作队列默认。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:5888](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:5888>)、[_schemas.ts:25](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/orders/_schemas.ts:25>)

**验收：** 输入精确订单号可以定位，返回列表仍保留筛选/页码。

<a id="o-05"></a>

### O-05 [P3] 日常打印/处理只能逐单打开，缺少批量准备入口

**现象：** 列表无选择列/多选状态，行操作只有下一状态与详情；打印只在单个订单 ActionBar 中执行。

**操作影响：** 打印多单拣货单、连续检查同阶段订单要反复打开/关闭详情，批量作业步骤随订单量线性增加。

**建议简化/修正：** 先增加低风险的多选批量打印和“处理下一单”；如未来增加批量状态变更，逐单检查资格、预览范围并逐项展示结果，不能跳过库存/付款校验。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:1680](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1680>)

**验收：** 选中 5 单可一次生成打印预览，连续查看不丢列表筛选。

<a id="o-06"></a>

### O-06 [P2] 缺货登记关键流程写死中文，意大利语页面仍无法读懂

**现象：** 缺货 Dialog 的标题、默认全货说明、实际给货数量、数量提醒、退款流程说明、原因 placeholder 和保存按钮都未使用 text/locale。

**操作影响：** 意大利员工在最需要准确理解少给数量和退款后果的地方遇到中文，可能误填或无法独立处理。

**建议简化/修正：** 整段纳入当前后台词典，并将“实际给货数量”“将少给几件”“将创建退款申请”作为统一预览。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:4692](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:4692>)

**验收：** 该 Dialog 无中文残留，数量和退款影响在两种语言一致。

<a id="o-07"></a>

### O-07 [P3] 手机操作阶段和待办筛选横向隐藏，缺少提示

**现象：** 360像素意大利语下，只看到全部订单、新订单和部分已接单；Picking/已打包/已发货、超期锁货在横向滚动区后方。

**操作影响：** 新用户可能不知道还有后续阶段；触屏需要横滑，查阶段的步骤变多。

**建议简化/修正：** 提供带全部选项的阶段下拉或折叠更多筛选，保留当前阶段标签；如继续横滑，加渐隐/箭头/可见滚动线索。

**证据：** 真实组件360意大利语截图与几何确认；这是容器内横向滚动，不是整页错位。 [admin-orders-panel.tsx:1278](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1278>)

**验收：** 手机可以发现并进入最后一个阶段及待办筛选。

## 商品与目录

<a id="p-01"></a>

### P-01 [P3] 商品下的五个工作区跨了多种日常任务

**现象：** 商品目录、近期售出缺货、到货批次、首页横幅、目录管理同级排在商品内部；价格活动又在账号页折叠面板，REMAX是独立页。

**操作影响：** 管理员需要记住功能藏在哪个模块，尤其首页横幅/价格活动和业务归属不直观。

**建议简化/修正：** 按商品、采购库存、客户价格、内容运营组织入口；保留原URL兼容和常用快捷入口，不必一次重构所有页面。

**证据：** 线上与模拟五页签观察 + 发布源码。 [admin-products-panel.tsx:2394](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:2394>)、[admin-accounts-panel.tsx:938](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:938>)

**验收：** 新员工可按业务任务快速找到横幅、批次、补货和价格检查。

<a id="p-02"></a>

### P-02 [P3] 商品详情六页签采用660px隐藏滚动条

**现象：** 详情页签容器overflow-x-auto，同时隐藏滚动条，内部min-width660px；手机无法同时看到库存、媒体、兼容与审计。

**操作影响：** 后半段功能存在但难发现，常要左右来回拖动。

**建议简化/修正：** 手机使用下拉/分组导航，或保留可见横滑提示和当前页定位；编辑阶段锁定其他页签时解释原因。

**证据：** 发布源码确认，商品详情合成页面已打开并查看；390px只显示前三项，全部6项保留在横滑区域。 [admin-products-panel.tsx:7339](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:7339>)

**验收：** 390px可发现和进入全部6页签，状态锁定有说明。

<a id="p-03"></a>

### P-03 [P2] Excel导入关闭会直接清空文件、粘贴和预览

**现象：** handleOpenChange(false)无脏数据/处理中检查，立即清空file、pasteText、preview、确认项、pending和结果。

**操作影响：** 误按Esc/关闭可丢大量准备工作；处理中关闭使结果不容易回看。

**建议简化/修正：** 有草稿离开提示保存/放弃；处理中阻止关闭或明确后台任务与可恢复结果；失败保留源和预览。

**证据：** 发布源码确认；既有后台审查未真实导入。 [admin-product-import-dialog.tsx:107](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:107>)

**验收：** 粘贴长表/已生成预览后关闭有保护；处理中不丢任务结果。

<a id="p-04"></a>

### P-04 [P2] 导入预览只显示部分字段名，缺少完整旧值→新值

**现象：** 桌面changes只显示前3个字段名和+N，手机只显示变更数量；此处没有展开完整差异或逐字段对比的按钮。

**操作影响：** 批量更新前不能在预览中充分核对究竟改哪些值，价格/型号变更尤其需要清楚。

**建议简化/修正：** 每行可展开完整旧值、新值与规则说明；批量只读检查聚焦阻断/价格/兼容变化，保留现有人工确认。

**证据：** 发布源码确认，未执行应用。 [admin-product-import-dialog.tsx:436](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:436>)、[admin-product-import-dialog.tsx:450](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:450>)

**验收：** 多于3项变更可全部查看，数量与实际差异一致。

<a id="p-05"></a>

### P-05 [P2] 商品审计每条只显示前6个变化，没有展开

**现象：** auditChangeItems(...).slice(0,6)后直接渲染，没有剩余数量或查看完整差异入口。

**操作影响：** 一个多字段编辑事件的后续变化会看不到，排查误改需要另找资料。

**建议简化/修正：** 默认前6项并明确+N可展开完整事件；敏感金额/身份字段优先显示。

**证据：** 发布源码确认。 [admin-products-panel.tsx:8434](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:8434>)

**验收：** 单次事件8项变化均可查看，默认摘要与完整明细一致。

<a id="p-06"></a>

### P-06 [P3] 目录排序需逐项输数字，手机编辑区在列表后方

**现象：** 目录编辑要求逐项选择、输入position并保存；窄屏采用上下布局，列表自身又可滚动，选择后需定位下方编辑区。已有自动scrollIntoView。

**操作影响：** 调多个分类顺序时重复操作；查看列表和编辑表单之间上下跳转。

**建议简化/修正：** 同列表提供上移/下移或拖动的待保存排序，手机用编辑抽屉；统一预览后保存，保留版本冲突校验。

**证据：** 发布源码确认 + 手机目录组件查看；不把已有自动滚动列为缺失。 [admin-catalog-directory.tsx:84](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-catalog-directory.tsx:84>)、[admin-catalog-directory.tsx:103](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-catalog-directory.tsx:103>)

**验收：** 调整5项顺序能一次核对提交，冲突时草稿保留。

<a id="p-07"></a>

### P-07 [P3] 批次详情在小平板就启用1180px宽表格

**现象：** 批次明细sm断点即切到桌面表格，min-width1180px，9列百分比宽度还合计117%另加序号列。

**操作影响：** 640–1024px平板需要大量横滑，成本/库存/问题不在同一视野；百分比需浏览器重分配。

**建议简化/修正：** 表格断点按真实容纳宽度调整，平板用行展开/列选择；固定关键商品/数量列，把成本附加字段放明细。

**证据：** 源码确认；满列真实批次样本尚未浏览器复现，列挤压属于待复验候选。 [admin-products-panel.tsx:4034](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:4034>)

**验收：** 768/1024和长商品名、有运输成本样本下列关系可读，标题与单元格对齐。

<a id="p-08"></a>

### P-08 [P3] 商品编辑的兼容性提示直接显示内部规则码

**现象：** 兼容复核提示把review.reasonCodes.join传给用户，并展示结构化字段说明；模拟长名称商品出现MULTI_MODEL_TITLE/STRUCTURED_MODELS_INCOMPLETE等英文规则码。

**操作影响：** 店员需要理解技术字段才能完成商品编辑，问题与纠正步骤不够直接。

**建议简化/修正：** 把规则码映射成业务说明和可点击修正字段，内部码折叠到技术详情；保留兼容性人工审核。

**证据：** 发布源码 + 合成编辑界面观察，未进行兼容写入。 [admin-products-panel.tsx:6841](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:6841>)

**验收：** 明确告诉用户识别到哪些候选、缺哪些字段、如何修正或确认。

## 缺货与补货

<a id="i-01"></a>

### I-01 [P2] 缺货和补货队列最多50条，导出也只用当前数组

**现象：** 三个库存请求均limit50，没有offset推进控件；exportCsv/exportPurchaseCsv对已读取rows/items生成文件。

**操作影响：** 大量SKU或采购行时，界面与导出不包含后面的条目，导出按钮未充分说明范围。

**建议简化/修正：** 补分页/游标，导出明确本页/全部匹配/已选；完整导出由受控只读接口按同筛选生成。

**证据：** 发布源码确认，模拟空状态已检查；未导出真实库存。 [admin-inventory-panel.tsx:267](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:267>)、[admin-inventory-panel.tsx:416](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:416>)

**验收：** 51+条样本可访问和导出；导出数量、范围明确。

<a id="i-02"></a>

### I-02 [P2] 库存体检只展示前8项，没有查看全部问题入口

**现象：** 体检表rows.slice(0,8)；摘要可显示更多异常数，但表格末尾没有加载更多或完整问题列表链接。

**操作影响：** 工作人员看到问题总数后无法逐条追查剩余异常。

**建议简化/修正：** 增加查看全部异常并预填类型/严重度；首屏保留8项高优先级摘要。

**证据：** 发布源码确认。 [admin-inventory-panel.tsx:1141](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1141>)

**验收：** 9+异常可以逐项定位，摘要与列表范围清楚。

<a id="i-03"></a>

### I-03 [P3] 补货计划主要逐行加入、修改和保存

**现象：** 缺货行逐行加入队列；队列编辑供应商、数量、备注后逐行保存，状态选择又直接单条PATCH。

**操作影响：** 处理几十件同供应商补货要反复点击，且保存资料与改变状态的时机不一致。

**建议简化/修正：** 多选形成采购草案；同供应商批量填写、统一预览与保存，状态推进逐项检查并显示部分失败。

**证据：** 发布源码确认，尚未模拟批量功能。 [admin-inventory-panel.tsx:942](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:942>)、[admin-inventory-panel.tsx:1330](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1330>)、[admin-inventory-panel.tsx:1380](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1380>)

**验收：** 10条补货统一核对后提交，失败行明确且不重复已成功项。

## 售后

<a id="r-02"></a>

### R-02 [P2] 售后每个队列固定前80条，缺少继续浏览入口

**现象：** 正式版本仍固定limit=80、offset=0，列表没有分页或加载更多。新版已有完整/部分计数和≥标记，计数说明已改善；剩余问题是第81条的浏览入口。

**操作影响：** 一个阶段超过80条时，无法从当前队列继续翻查后面的申请，可能遗漏待处理事项。

**建议简化/修正：** 提供分页/加载更多并显示当前返回/总数；保持选中记录和草稿，允许直接按RMA/订单号定位。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-rma-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:430>)

**验收：** 第81条可访问，筛选后总数/已显示数准确。

<a id="r-03"></a>

### R-03 [P2] 售后详情缺少客户原始故障原因和原始描述

**现象：** 正式版本已展示requestedResolution、换货订单及后台处理备注，但没有消费客户原始reason、reasonCode、description。repository把这些字段和customerVisibleNote从独立列映射，后台处理备注不能保证等同于原始申请。

**操作影响：** 审核人员要判断故障、核对附件时，同页可能缺少客户最初写下的文字；有描述的真实样本仍需进一步只读核对。

**建议简化/修正：** 把原始故障原因、客户原文、申请数量和附件放在详情顶部的只读申请卡；现有诉求、推荐动作和换货/协商分支继续复用。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-rma-panel.tsx:983](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:983>)、[partspro-repository.ts:16190](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:16190>)

**验收：** 合成reason/description与customerVisibleNote不同的申请，详情完整显示原始申请，且后台备注分组明确。

<a id="r-07"></a>

### R-07 [P3] 手机六阶段栏的后半段缺少可发现的入口

**现象：** 390手机首屏主要见审核、待寄回、收货中及部分质检，结算和库存关闭需要横滑；阶段条没有明显滚动提示。

**操作影响：** 当前已在后期处理的申请不容易直接找到。

**建议简化/修正：** 阶段下拉/更多阶段入口，或保留横向栏并提示剩余阶段。

**证据：** 线上390视口 + 当前组件截图/几何确认。 [admin-rma-panel.tsx:755](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:755>)

**验收：** 不用试探就能知道六阶段齐全，并切换到库存关闭。

<a id="r-08"></a>

### R-08 [P3] 手机空队列仍保留大块空白详情占位

**现象：** 没有申请或未选择记录时，列表下方仍显示很高的空详情面板，短屏大部分空间只写选择一条申请。

**操作影响：** 首屏有效内容少；用户会继续滚动寻找实际上不存在的详情。

**建议简化/修正：** 空队列时收起详情占位，只保留一行说明；有记录手机打开详情抽屉/独立详情页。

**证据：** 线上空队列截图 + 模拟空状态确认。 [admin-rma-panel.tsx:845](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:845>)

**验收：** 空队列手机不出现大块无任务区域；有记录能自然进入详情。

## 账号

<a id="a-01"></a>

### A-01 [P2] 账号编辑对话框关闭直接销毁草稿，提交中也没有关闭拦截

**现象：** 三个 Dialog 的 onOpenChange 直接调用 onClose；父组件 onClose 直接清空 conversion、customerAction、profileEditor。取消按钮禁用 submitting，但 Dialog 关闭回调没有同样保护。

**操作影响：** 误触遮罩/Esc/关闭可丢掉较长地址和审计原因；提交期间关闭后无法在原表单查看失败并继续修改。

**建议简化/修正：** 脏草稿离开时提示保存/放弃，并将提交中状态应用到所有关闭路径；失败在当前表单内说明。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1131](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1131>)、[admin-accounts-panel.tsx:2186](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2186>)

**验收：** 修改多个地址字段后意外关闭有保护；提交中不允许销毁输入。

<a id="a-02"></a>

### A-02 [P2] 想修一个电话也必须先补全整份档案，表单未按任务拆分

**现象：** canSubmit 同时强制客户名、电话、税号、配送地址、账单地址完整和至少三字原因；编辑区始终显示完整资料及地址。

**操作影响：** 历史资料不完整时，修电话/PEC 等单项也会被无关缺失字段阻止，需要一次处理很多信息。

**建议简化/修正：** 把“补全资料用于购买”与“修正已知字段”分开；字段级修正只提交变化内容并审计，订单使用资格仍由完整资料校验守住。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:2427](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2427>)

**验收：** 合成缺地址客户仍可修非地址信息；checkout 完整性规则保持有效。

<a id="a-03"></a>

### A-03 [P2] 有效权限只展示前 24 个，+N 无展开动作

**现象：** `detail.permissions.slice(0,24)`，超过 24 后只渲染普通 Badge `+N`，没有点击或展开入口；详情头部又显示完整权限数量。

**操作影响：** 审核员工能不能执行特定操作时，看不到第 25 项以后的具体权限，权限标签的顺序会决定是否可查。

**建议简化/修正：** 展示全部可搜索权限，默认按业务域折叠；+N 改为“查看全部”并可聚焦查询。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1991](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1991>)

**验收：** 任意权限均可在详情查询到，数量与列表一致。

<a id="a-04"></a>

### A-04 [P2] 员工角色调整只选名称，缺少权限变化预览

**现象：** RoleTemplate 包含 permissions/description，但角色 Dialog 只渲染 roleTemplateLabel，随后填写原因并保存；没有当前/目标权限差集或目标职责说明。

**操作影响：** 管理员必须凭记忆知道角色名称的实际权限，难以在保存前识别敏感权限新增或原权限撤销。

**建议简化/修正：** 在同一 Dialog 展示目标角色说明及新增/移除权限摘要，敏感权限显著标记；无需多开另一个页面查。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:2203](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2203>)

**验收：** 切换角色可直接看到差异，缺模板数据时不给一个看似可靠的默认角色选择。

<a id="a-05"></a>

### A-05 [P2] “历史订单”实际只取最近 20 条，还没有进入订单处理的链接

**现象：** 账号 API 的 ledger RPC 使用 p_order_limit:20，fallback 同样 limit(20)；UI 标題“历史订单”后只 map，没有分页、加载更多或近期限制提示；订单号是普通 div，消费明细同样是 span。

**操作影响：** 用户以为能查看完整历史，却无法找到更早订单；找到问题单后仍需离开账号，再去订单后台重新定位。

**建议简化/修正：** 明确“最近20单”，提供“全部订单”入口并预填 customerId，列表订单号直接打开对应详情；保持返回客户上下文。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1864](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1864>)、[_account-data.ts:1039](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/accounts/_account-data.ts:1039>)

**验收：** 21+ 单合成客户可查到旧单，点击订单可进入处理并返回当前账号。

<a id="a-06"></a>

### A-06 [P2] 账号面板主要操作和反馈写死中文，当前 i18n 只覆盖少量角色标签

**现象：** 标题辅助、刷新、账号切换、搜索、空状态、变更/编辑表单、成功反馈均有直接中文；组件虽使用 useAdminText，但这些区域没有使用词典。

**操作影响：** 意大利员工难以管理账号、完整理解角色转换和资料变更，和订单/财务/RMA 的语言体验不一致。

**建议简化/修正：** 统一后台词典，优先覆盖身份变更、权限、保存结果与校验文案；地址术语保留意大利字段名并给清晰说明。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1002](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1002>)、[admin-accounts-panel.tsx:2188](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2188>)

**验收：** 账号全部常用操作、校验、成功/失败消息跟随当前语言。

## 财务

<a id="f-01"></a>

### F-01 [P1] 财务逗号小数输入会发出null，API金额校验可将其转换为0

**现象：** 金额/IVA Input 是文本，仅 inputMode=decimal；提交使用 Number，没有规范化逗号和有限数校验。`Number("12,50")` 为 NaN，JSON.stringify 发送 null，而当前 `z.coerce.number().nonnegative()` 把 null 转成 0。

**操作影响：** 输入习惯上正常的 €12,50 可能变成 €0，而不是字段级拒绝；这比普通保存失败严重。最终真实数据库是否允许此行，既有后台审查未写库验证。

**建议简化/修正：** 统一金额解析器接受当地小数格式，提交前要求 finite/合法精度；API 禁止 null/coercion 将缺失或非法值变成 0；显示净额、IVA、总额预览。

**证据：** 发布基准源码确认 + 真实组件/模拟接口交互复现：输入12,50，浏览器请求的amountNet为null；本地Zod表达式把null解析为0。未向真实数据库保存。 [admin-finance-panel.tsx:650](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:650>)、[_shared.ts:37](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/_shared.ts:37>)、[partspro-repository.ts:8456](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:8456>)

**验收：** 12,50、12.50、空字符串、非法文本、负数都按明确规则解析/拒绝；金额不静默变 0。

<a id="f-02"></a>

### F-02 [P2] 付款时间默认取 UTC 文本，再作为本地时间提交，罗马时区偏移

**现象：** paidAt 初值及保存后重置用 `new Date().toISOString().slice(0,16)`，datetime-local 显示该值，提交再用 `new Date(form.paidAt).toISOString()`。日期 todayDate 也使用 UTC 切片。

**操作影响：** 欧洲夏令时默认付款时刻可能早两小时，冬季早一小时；本地午夜后的 date 默认可能仍是前一天，影响对账日期。

**建议简化/修正：** datetime-local 用本地年月日时分生成，只在提交时转换 UTC；日期字段使用用户本地日期。

**证据：** 发布基准源码确认 + Europe/Rome本地时区转换复现；未做真实记账。 [admin-finance-panel.tsx:744](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:744>)

**验收：** Europe/Rome 夏令/冬令及午夜边界，默认值保存后保持同一时刻/日期。

<a id="f-03"></a>

### F-03 [P2] 记供应商付款时，批次下拉受报表筛选控制

**现象：** batchOptions 来自当前 ledgerRows 的 purchase 项并 slice(0,80)，该 ledgerRows 与全部报表筛选共用；付款保存必须有 batchId。

**操作影响：** 正在查看费用/某供应商/近期报表时，想给旧批次付款，目标可能完全不出现在下拉；用户得先退出或重置报表筛选才能记账。

**建议简化/修正：** 付款 Dialog 独立按供应商/批次搜索并获取未结清批次；提供欠款余额、最近付款和付款后余额预览，不依赖当前报表可见行。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:257](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:257>)

**验收：** 报表设费用分类时仍可选任意合法待付批次。

<a id="f-04"></a>

### F-04 [P2] 财务明细固定取默认 50 条，没有分页或总数说明

**现象：** buildFinanceParams 不设置 limit/offset；financeQuerySchema 默认 limit50 offset0；ledger API 返回 total 等 meta，但面板仅消费 data；FinanceTable/CogsTable 直接 map 无分页控件。

**操作影响：** 同一期间超过50条时，明细和报表摘要可能看起来对不上，且用户无法在页面继续查完整期间记录。

**建议简化/修正：** 消费 total/returned、增加分页或加载更多；明确显示“已显示50/总N条”，必要时“查看全部/导出”与当前筛选共用。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:236](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:236>)、[_shared.ts:13](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/_shared.ts:13>)

**验收：** 第51条可继续查询，当前显示数与完整总数清晰。

<a id="f-05"></a>

### F-05 [P2] 记错费用/付款后页面没有修正入口，已有 PATCH 接口未接入

**现象：** FinanceTable 七列全是展示，行无详情/编辑/状态动作；所有写 UI 仅为新建。对应接口已有 expenses/[expenseId] PATCH。

**操作影响：** 录错金额/日期/备注后，员工只能从别处找修正方法，容易以新增一行来弥补错误，导致重复记录。

**建议简化/修正：** 行详情提供有权限的编辑/取消记账，清晰显示原值→新值与审计原因；金额修正保留审计，不用删除重建。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:517](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:517>)、[route.ts:15](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/expenses/[expenseId]/route.ts:15>)

**验收：** 在模拟记录上能修正日期/描述，并显示原记录、变更和保存结果。

<a id="f-06"></a>

### F-06 [P2] 错误被替换为泛化消息，明细失败又渲染“无数据”

**现象：** loadSection 对非ok只抛 copy.loadError，不解析 API error；保存两个 Dialog 也只 alert(copy.saveError)。每次加载先清空 rows，错误只放页面顶端，而 FinanceTable/CogsTable 没有 error prop，loading结束后空数组显示 copy.empty。

**操作影响：** 用户不知道是无权限、输入不合法还是服务失败，也可能把一次请求失败理解成该期间没有记录；需要反复尝试才能排查。

**建议简化/修正：** 读取接口具体错误并匹配字段；每个明细区显示“读取失败 + 重试”，失败保留旧结果并标明旧数据，而不是变成空表。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:207](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:207>)

**验收：** 空/失败/旧结果三种状态可区分，表单能定位具体失败字段。

<a id="f-07"></a>

### F-07 [P2] 财务只读员工仍看到新增费用/付款按钮

**现象：** AdminFinancePanel 不接权限 props，头部总是渲染 ExpenseDialog 与 SupplierPaymentDialog；read接口要求 finance.read，两个POST要求 finance.manage。

**操作影响：** 只读员工需填写完整表单后才得到泛化保存失败；权限边界在界面不可解释。

**建议简化/修正：** 按finance.manage显示/禁用写入口，并说明缺少记账权限；读取报表权限不等于可以创建流水。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:279](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:279>)

**验收：** 只读角色可正常看报表，不能进入可提交记账表单。

<a id="f-08"></a>

### F-08 [P2] 手机财务多行页签高度没有撑开，覆盖下方卡片

**现象：** 360px意大利语下，5个页签排成3行；TabsList的h-auto被公共TabsList方向高度样式影响，后两行伸出容器，Acquisti e debiti/Spese/Export覆盖下方总览区域。

**操作影响：** 页签和总览信息在同一区域叠放，页面关系混乱，触摸操作可能误判目标。

**建议简化/修正：** 像已修复的商品工作区一样明确覆盖方向高度，让多行网格撑开；页签文字可换行并设合理最小高度。

**证据：** 发布基准真实组件与对应CSS截图实际复现；线上财务手机视口未单独复验。 [admin-finance-panel.tsx:297](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:297>)、[tabs.tsx:25](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/ui/tabs.tsx:25>)

**验收：** 360/390中意界面五页签全部在容器内，下一内容区在最后一行后；点击每项正确进入且不覆盖卡片。

## 电商

<a id="e-01"></a>

### E-01 [P2] eBay未保存设置时也可以生成计划，后续刷新会覆盖草稿

**现象：** 修改draft后，生成计划/发布/同步按钮不检查dirty；请求只发action，不发当前草稿，成功后loadOverview从服务器重置draft。模拟把加价改为25，点击计划请求仍只有plan_listings。

**操作影响：** 用户以为计划使用刚输入的配置，实际使用已保存配置，草稿还可能被覆盖。

**建议简化/修正：** 有未保存修改时先核对并保存，或阻止动作并显示使用的配置版本；完成后保留未提交草稿。

**证据：** 发布源码 + 真实组件/模拟API交互复现。 [admin-marketplace-panel.tsx:328](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:328>)、[admin-marketplace-panel.tsx:238](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:238>)

**验收：** 未保存加价/政策/映射不能悄悄按旧设置执行，刷新不静默抹草稿。

<a id="e-02"></a>

### E-02 [P2] eBay缺少连接和就绪的逐步引导

**现象：** 未连接状态仍显示所有政策ID、映射和发布/同步入口；按钮主要依据权限和busy，无连接/字段就绪向导。

**操作影响：** 店员需了解merchantLocationKey、政策ID、成色1000等术语，缺项要到提交失败才发现。

**建议简化/修正：** 连接→读取可用业务政策→选择分类/价格→预览范围→发布，用就绪清单和下拉选择替代手抄ID。

**证据：** 线上未连接界面 + 发布源码确认；未连接真实eBay或发布。 [admin-marketplace-panel.tsx:452](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:452>)、[admin-marketplace-panel.tsx:541](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:541>)

**验收：** 未连接不能误入发布；每个缺项旁边给出可完成的下一步。

<a id="e-03"></a>

### E-03 [P3] eBay手机四张统计卡占满首屏

**现象：** 390px四张统计卡单列，连接和设置都排在其后，首屏只能看到连接卡的一部分；映射和队列更远。

**操作影响：** 常用任务大量上下滚动，空数据状态也保留同等高度。

**建议简化/修正：** 手机KPI压缩成2×2或一行摘要；连接/处理主动作前置，设置和队列分任务页签。

**证据：** 真实组件390截图确认，线上桌面布局已观察。 [admin-marketplace-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:430>)

**验收：** 390首屏能找到当前主任务入口，非关键统计不挡操作。

<a id="e-04"></a>

### E-04 [P3] eBay映射在手机仍是多列可编辑宽表

**现象：** 手机映射字段均在Table内，每个Input有min-w24/28/32/36等宽度；模拟390px整表约772px，成色、启用、删除都在横向后半段。

**操作影响：** 编辑同一映射要反复左右拖动，删除/启用与对应本地分类可能不在同一屏。

**建议简化/修正：** 手机改分类映射卡片/抽屉，固定分类与品牌，在一张表单里完成其他字段。

**证据：** 合成完整映射数据几何确认 + 源码；属于容器横滑，未发现整页横向溢出。 [admin-marketplace-panel.tsx:724](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:724>)

**验收：** 手机可完整核对一条映射并看到启用/删除的对象。

<a id="e-05"></a>

### E-05 [P2] 执行队列一次只处理5条，缺少继续处理的明确路径

**现象：** runJobs请求固定limit5；界面只展示执行队列按钮与队列摘要，没有按剩余量持续处理或进度按钮。

**操作影响：** 队列较长时需要反复手动点击，也不容易判断还剩多少及失败项是否应重试。

**建议简化/修正：** 显示本轮处理/剩余/失败，提供受控继续处理或后台批次进度；重试只针对可重试项。

**证据：** 发布源码确认；未执行真实队列。 [admin-marketplace-panel.tsx:384](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:384>)

**验收：** 有12条模拟队列时明确展示每轮与剩余，并保留失败原因。

<a id="e-06"></a>

### E-06 [P2] eBay整页主要写死中文和技术英文

**现象：** 标题、设置、反馈和操作直接用中文，政策字段为英文ID，未使用后台词典。

**操作影响：** 意大利员工在切换语言后仍无法完整阅读刊登和同步操作后果。

**建议简化/修正：** 优先翻译发布、同步、取消、失败与连接步骤，再用业务名称解释政策字段；内部ID作为附加信息。

**证据：** 正式源码确认，意大利语合成页仍显示电商/eBay连接等中文。 [admin-marketplace-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:430>)、[admin-marketplace-panel.tsx:541](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:541>)

**验收：** 意大利语下整条eBay工作流文字可读，关键动作与范围准确。

## 客服

<a id="s-01"></a>

### S-01 [P1] 回复草稿跨会话保留，可能发送给另一客户

**现象：** reply是整个面板单一state；切换conversation只改selectedId/detailView，未按会话保存/重置。模拟在A输入草稿、切到B后，B的回复框仍保留A内容。

**操作影响：** 切换客户处理时可能把为A准备的内容误发B，属于误操作风险；既有后台审查没有发送真实或模拟消息。

**建议简化/修正：** 按conversationId存草稿；切换时加载该会话草稿，发送前核对会话ID与当前详情，必要时提醒保留草稿。

**证据：** 发布源码 + 两个合成会话交互复现。 [admin-support-panel.tsx:249](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:249>)、[admin-support-panel.tsx:637](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:637>)

**验收：** A/B互相切换只展示各自草稿；待发送内容始终绑定当前会话。

<a id="s-02"></a>

### S-02 [P2] 客服队列固定50/100条，没有搜索和翻页

**现象：** 桌面会话请求limit50 offset0，手机inbox请求limit100 offset0；页面有状态/归属筛选，没有客户/订单/内容查询或继续翻页。

**操作影响：** 会话量增加后难找旧客户咨询；手机和桌面显示范围不同且不容易解释。

**建议简化/修正：** 服务端查询客户/会话号，统一分页和总数说明；手机队列也支持状态与历史查询。

**证据：** 发布源码确认；未查询真实历史消息。 [admin-support-panel.tsx:266](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:266>)、[admin-support-panel.tsx:303](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:303>)

**验收：** 101+合成会话可查旧记录，桌面/手机范围与状态一致。

<a id="s-03"></a>

### S-03 [P2] 切换会话读取失败时，旧详情仍留在回复区域

**现象：** refreshDetail启动不清旧detail，失败只setNotice；回复按钮只检查会话open、pendingAction和草稿，未校验selectedId===detail.conversation.id或isLoadingDetail。

**操作影响：** 高亮B但详情仍是A时容易混淆发送对象；需要按失败条件进一步验证。

**建议简化/修正：** 切换时锁住发送，旧详情明确标记来自A，失败针对B给重试；发送同时验证选中ID与详情ID。

**证据：** 发布源码确认；B详情GET失败的条件交互尚未复现，列为风险候选。 [admin-support-panel.tsx:345](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:345>)、[admin-support-panel.tsx:556](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:556>)、[admin-support-panel.tsx:952](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:952>)

**验收：** 模拟B读取失败，不能向A提交看似属于B的回复。

## 活动记录

<a id="m-01"></a>

### M-01 [P2] 活动时间线没有接入真实活动源

**现象：** defaultAdminActivities为空，Dashboard不传initialActivities；组件没有读取后台活动API，添加/标重要仅改React state。

**操作影响：** 运营入口看似能查活动，但实际没有真实订单/库存/权限日志可查。

**建议简化/修正：** 连接真实审计事件的只读列表，按对象直达详情；本地便签明确作为独立个人工具。

**证据：** 线上页面待观察 + 发布源码确认；未代表数据库无日志。 [admin-activity-timeline.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:120>)、[admin-dashboard.tsx:487](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:487>)

**验收：** 真实授权事件可查且日期/对象/权限范围清楚。

<a id="m-02"></a>

### M-02 [P3] 手机隐藏了本地备注的说明，刷新会丢便签

**现象：** 本地备注只存在state；说明localNoteDescription在hidden lg:block内，手机用户主要看到添加入口。

**操作影响：** 用户可能把备注当可长期保存的协作记录，刷新后才发现消失。

**建议简化/修正：** 要么保存到有权限的备注服务并给保存状态，要么在手机输入和提交旁明确既有后台审查页面临时便签。

**证据：** 发布源码确认；既有后台审查未把实际业务内容写进便签。 [admin-activity-timeline.tsx:180](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:180>)、[admin-activity-timeline.tsx:282](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:282>)

**验收：** 刷新/离开前用户知道是否持久化，永久备注能回读。

## 设置权限

<a id="t-01"></a>

### T-01 [P2] 权限矩阵点一次就立即生效，缺少变更差异核对

**现象：** 角色选择和每个继承/允许/拒绝按钮直接PATCH；原因是自动生成的英文句子，没有新增/撤销权限预览或管理员输入原因。

**操作影响：** 误点可能立即改变员工操作能力；调整多个权限也须多次请求且难核对完整结果。

**建议简化/修正：** 先形成待应用变更，显示对象、原值→新值、有效权限差集与敏感权限；一次确认带业务原因，写后回读。

**证据：** 发布源码确认；既有后台审查未点击真实权限写入。 [admin-permissions-panel.tsx:268](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:268>)、[admin-permissions-panel.tsx:305](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:305>)

**验收：** 权限变更有完整预览、审计原因和回读，批量部分失败清楚。

<a id="t-02"></a>

### T-02 [P3] 后台设置外层中文，内部权限页却随语言切换

**现象：** AdminSettingsPanel标题/说明写死后台设置和管理员工角色，内嵌权限页使用词典。

**操作影响：** 意大利界面出现中意混排，标题与内部用语不统一。

**建议简化/修正：** 外层标题/说明纳入词典；与账号工作台统一员工、角色、权限术语。

**证据：** 360意大利语组件截图明确复现。 [admin-settings-panel.tsx:13](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-settings-panel.tsx:13>)

**验收：** 意大利語设置页无中文标题残留。

<a id="t-03"></a>

### T-03 [P3] 手机员工列表用大块最小高度，少量员工时空白很大

**现象：** 员工区max-height计算同时min-height240，卡片保持长列表区域；1个合成员工下屏幕主要是空白，角色和权限还需再切页签。

**操作影响：** 查看少量员工时信息密度低，用户需多次切换才能核对对象与权限。

**建议简化/修正：** 列表高度随数量缩短，选中员工摘要始终可见；常用有效权限与角色说明在同一详情内组织。

**证据：** 360意大利语合成截图 + 源码确认。 [admin-permissions-panel.tsx:428](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:428>)

**验收：** 1/10/100员工状态下无过度留白且选中对象清楚。

## REMAX

<a id="x-01"></a>

### X-01 [P3] REMAX后台从总览快捷链接进入，缺统一模块导航和语言

**现象：** 独立/admin/remax采用单独main和意大利文标题/说明，普通后台侧栏没有REMAX入口。

**操作影响：** 使用中文后台的人进入另一套页面后缺一致导航；日常到货要记住入口位置。

**建议简化/修正：** 在采购/商品区域提供固定REMAX入口，复用后台导航和双语；保留预订与真实到货确认的业务区别。

**证据：** 发布页面和组件源码确认；既有后台审查未浏览已登录REMAX真实业务数据。 [admin-remax-center.tsx:251](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:251>)、[page.tsx:39](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/admin/remax/page.tsx:39>)

**验收：** 入口可发现、语言跟随后台，能返回原模块。

<a id="x-02"></a>

### X-02 [P2] REMAX待处理预订单只列前8条，没有查看全部入口

**现象：** SummaryCard用dashboard.orders.slice(0,8)显示客户预订单，没有分页/查看全部/点击订单详情；右侧待收货也主要依赖批次下拉。

**操作影响：** 看到待处理数量后无法在该页逐单追查第9单，需要回订单模块重新找。

**建议简化/修正：** 摘要保留8单，提供全部REMAX预订单并预填商品/批次条件，订单号直达详情。

**证据：** 发布源码确认；未读取真实预订单。 [admin-remax-center.tsx:384](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:384>)

**验收：** 9+预订单可完整查询，点击能进入原单并返回批次。


## 已存在并应保留的设计

- 目录已有最新请求保护、URL/popstate同步、错误提示、加载更多和真实分类选择；本报告只指出现有缺口，不建议全部重写。
- 商品手机卡片已有本页选择，目录/商品已有版本冲突防护、创建防重、未保存提示和图片失败重试；不能再用旧候选把它们报成缺失。
- 购物车与结账有账号隔离、价格/库存/MOQ权威核对、报价失败关闭和金额加载状态；简化不能绕过这些控制。
- 最新客户售后已支持三块申请流程、单订单行自动选择、照片验证、幂等提交、当前页内重试/清理、已提交恢复和可选发货信息。不能用主目录旧复杂售后代码替代已发布版本的结论。
- 后台售后已有阶段、推荐动作、阻断说明、协商/分拆、替换件和退供应商路径；退款批准、库存入账、物理到货确认和兼容人工审核应保留。
- Dialog/Sheet已有动态可视区域保护与正文滚动；本轮不宣称不存在软键盘适配。真实Safari/软键盘仍需验证。
- 发布基准首页横幅是手动切换，没有主目录候选中的两秒自动播放；已排除把该候选节奏误报为线上缺陷。主目录自动播放及其暂停/减少动画防护应在候选实施任务另行验收。
- 订单列表已有当前页统计提示；不把后台订单当前页KPI与总览H-01混成同一个错误。
- 目录中的内部横向滚动、隐藏图表辅助元素、正常加载占位不自动判定为页面错位。

## 实施批次与验证建议

1. **先处理P1与结果未知。** CHECK-01、F-01、S-01/S-03需应用和数据契约一起收尾；使用隔离数据验证，提交/回读/通知状态分开。任何schema变更独立进入migration门禁，不把此报告当作db push或部署授权。
2. **修正已经看到的挤压和遮挡。** U-02、U-03、CARD-01、DETAIL-02，以及F-08/G-02。按具体断点和长意大利语内容复验，读取控件几何并实际点击/输入，不能仅验整页scrollWidth。
3. **补上下文、历史与恢复。** CAT-01/05、AUTH-07、CHECK-04、ACCOUNT-01/02/03/04、RMA-C-02/03/04及后台查找/列表范围。成功、失败、空、慢、返回、换账号分别验证。
4. **统一业务文案和语言。** U-05、ACCOUNT-05、CHECK-05，连同后台关键动作。先确认账户状态/价格/权限实际契约，再统一文字。
5. **完成高频流程简化。** 手机常驻搜索、预填资料、少无效下拉、已有申请直达、钱包来源、批量SKU预览与后台查询。用少量代表性任务比较完成步骤与纠错成本，再决定改版程度。

实施代码时使用当前AGENTS的风险匹配验证地图和真实package.json命令。此项目没有test/test:all或E2E脚本，不能虚构，也不能把lint/build当完整业务E2E。报告本身不改应用，不需要重复全量构建。

## 仍需补充的验收范围

| 范围 | 尚缺证据 | 后续方法 |
|---|---|---|
| 登录客户与员工UI | 本轮只做匿名公开交互 | 授权测试账号，最小角色/权限组合只读先行 |
| 下单/钱包/库存防重 | 新增风险是静态跨层结论 | 隔离事务成功但响应丢失、并发相同requestId |
| 财务/客服真实业务 | 原报告模拟载荷/草稿复现，未真实记账/发送 | 合成数据先修，真实业务验收需具体授权 |
| 资料/专业申请/邮件 | 未提交申请、注册、验证码、密码恢复 | 受控测试身份和真实邮件送达验收 |
| RMA照片与刷新恢复 | 本轮只读发布源码 | 隔离照片/草稿，真实设备相机与网络中断 |
| Safari/软键盘/安全区 | 模拟视口不能替代真机 | 真实iPhone、横屏、键盘输入、焦点与浮层 |
| 极端内容/数据量 | 当前公开样本和既有合成样本有限 | 长SKU/型号/译文、200单以上、8笔以上、队列上限 |
| 最新全面修复工作树 | 属于另一个实施任务，读取时尚未发布 | 由该任务按精确提交和发布候选独立验收 |

## 证据与维护

- 本轮 [浏览器观测与尺寸](../../outputs/frontend-audit/2026-10-10/browser-observations.json)。
- 本报告 [可检索问题清单](../../outputs/frontend-audit/2026-10-10/findings.json)；前台每项带性质、条件、建议和源码，后台有完整索引与原报告链接。
- 既有 [后台64项报告](2026-10-10-admin-panel-operation-ui-audit.md) 与 [后台审查索引](../../outputs/admin-audit/2026-10-10/audit-index.json)。
- 既有布局示例：[财务多行页签](../../outputs/admin-audit/2026-10-10/finance-360-it-IT.png)、[短屏侧栏](../../outputs/admin-audit/2026-10-10/sidebar-short-1280.png)。它们是既有合成或既有线上证据，不能计为本轮新检查。
- 发布与在途状态继续以项目 `docs/roadmap.md` 为准；报告是审查快照，不创建第二套任务状态。后续解决问题应记录对应ID、准确版本与验收证据，避免只改样式后把整个流程宣布完成。
