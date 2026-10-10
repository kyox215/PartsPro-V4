# PartsPro 后台操作与UI全面审查报告

审查日期：2026-10-10（Europe/Rome）。初次审查列出 **64 项独立问题/优化点**：P1 2项、P2 40项、P3 22项。2026-10-11补充子流程审查新增16项，累计80项；新增问题与初次64项分开记录。同一问题的跨页面表现只计一次；没有将所有横向滚动都当成页面错位。

## 后续修复与当前状态

原64项已完成修复、状态规范增强、批准范围内的单条迁移与正式发布。2026-10-11重新核对：正式运行源码e09af0e、部署dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ处于READY，www.partspro.app指向该部署。逐项实现、桌面/移动验证和未验收边界见 [修复与验证报告](2026-10-10-admin-panel-repair-verification.md)。**以下缺陷描述及页面覆盖表保留2026-10-10发布基准的审查记录，不表示这些64项仍是当前线上故障。** 当前已覆盖12个正式后台面板，统计与REMAX的上线实测追加在修复报告。

## 优先阅读

最先处理的是 **财务逗号金额转换（F-01）与客服草稿跨会话（S-01）**。随后是短屏侧栏遮挡（G-02）、订单/财务失败恢复（O-01/O-02/F-06）、订单查找（G-01/O-04）、真实数据口径（H-01）、eBay未保存配置执行（E-01）、列表读取上限（F-04/R-02/I-01/S-02）、可操作入口和权限一致性（O-03/F-07/T-01）。

P1表示可能误记金额/误发内容等需优先防护的风险；P2表示查找、处理、恢复、权限、信息口径等明显影响；P3表示步骤、布局、可发现性与学习成本的优化。优先级是本次建议，**不等于真实业务事故已发生**。

## 范围、版本和证据

- 覆盖后台全部11个一级可见菜单，实际可进入的10个面板、商品5个子工作区、商品详情/编辑、Excel导入、价格管理与REMAX独立页面。网站统计在发布基准中没有接入，已作为G-04列出。
- 主目录部分实现早于上线版本。本次根据项目roadmap及发布报告固定到运行源码 **832c53c916f15ff7bb751aff258b1ad8055a1cbc**。实际源码在本项目内 **.codex-worktrees/admin-products-ux-20261010**；其HEAD a32c8b9相对运行提交src/package.json/package-lock.json没有变化。后续主目录候选不作为线上现存缺陷。
- 线上Chrome已有登录会话：只读浏览总览、订单、售后、商品、电商、财务、账号等入口，查看桌面1437×827、手机390×844及短屏1280×568。没有点击收款、退款、发货、发布、权限保存或消息发送。
- 发布基准真实React组件和当前对应CSS：桌面1440×900、平板768×1024、手机390×844、360×740意大利文、短屏1280×568，共**50个实际面板/视口组合**。另5次analytics请求回到总览，不计为统计页验证。使用合成/空数据、模拟API，路由/语言持久化/Auth/Image适配器有stub，**不是完整Next运行时或生产E2E**。
- 补充组件交互：商品目录4个子工作区、金额输入请求载荷、客服A/B草稿、eBay未保存设置动作、短屏侧栏；操作产生的请求全部被模拟拦截。金额和时区还做了纯逻辑复现。
- 每项标明源码确认、浏览器复现或待复验。订单/账号/财务/售后的21项还完成了独立源码复核。没有读取生产数据库全量、制造线上失败、验证真实记账/退款/库存/导入/刊登/权限写入；物理iPhone/Safari和软键盘没有验收。此次未调用Vercel部署API再次核定线上SHA，以项目发布记录和实际页面观察为基准。
- 报告中的源码链接全部指向上述发布工作树；截图只采用合成数据，避免把客户真实资料放入报告。

## 页面覆盖表

| 页面/区域 | 已检查 | 主要问题类型 |
|---|---|---|
| 总览/公共导航 | 发布源码、线上只读、5视口组件 | 假搜索、样本口径、侧栏遮挡、返回上下文 |
| 订单/付款/发货/详情 | 发布源码、线上列表、5视口组件 | 无查询、表单失败恢复、权限、单单处理、手机阶段 |
| 商品/目录/批次/横幅/导入 | 发布源码、线上商品、5视口+子区/弹层组件 | 入口归属、隐藏页签、预览/审计不完整、导入关闭丢草稿 |
| 缺货/补货/体检 | 发布源码、390子区组件 | 数据上限、异常展开、逐行重复工作 |
| 售后 | 发布源码、线上空队列、5视口组件 | 80条上限、原始申请缺失、阶段可发现性、空详情 |
| 账号/员工/价格 | 发布源码、线上账号入口、5视口组件 | 长资料表单、权限展示、订单串联、中文残留 |
| 财务 | 发布源码、线上结构、5视口组件、金额交互/时区逻辑 | 金额解析、日期、批次选择、分页、更正、权限与错误 |
| eBay | 发布源码、线上未连接页面、5视口+动作模拟 | 草稿与配置、就绪流程、手机长页/宽表、队列、语言 |
| 客服 | 发布源码、5视口+合成A/B会话 | 草稿对象绑定、读取范围、详情失败保护 |
| 营销/时间线 | 发布源码、5视口组件 | 名称错配、没有真实事件源、临时备注 |
| 设置/权限 | 发布源码、5视口组件 | 即时生效缺核对、混合语言、留白 |
| 网站统计 | 线上禁用入口、发布源码 | 功能未接入；不声称检查过可用统计数据页 |
| REMAX独立页面 | 发布源码定向审查 | 导航/语言、前8单范围；真实页面数据未验收 |

## 问题目录

### 通用导航（9项）

- [G-01 P2｜顶部全局搜索框没有搜索行为](#g-01)
- [G-02 P2｜短屏桌面侧栏的账号区覆盖底部菜单](#g-02)
- [G-03 P2｜营销入口实际进入运营时间线](#g-03)
- [G-04 P2｜网站统计入口长期可见但始终禁用](#g-04)
- [G-05 P3｜底部账号卡像下拉菜单但没有操作](#g-05)
- [G-06 P3｜侧栏默认折叠且不保存用户选择](#g-06)
- [G-07 P2｜跨模块返回缺少稳定的筛选、页码和选中上下文](#g-07)
- [G-08 P3｜顶栏始终写运营后台，没有当前位置](#g-08)
- [G-09 P3｜部分可见字段标签未与输入控件关联](#g-09)

### 总览（3项）

- [H-01 P2｜总览的大数字依赖100条样本，容易被当成全站统计](#h-01)
- [H-02 P3｜30/90天图表与旁边7日指标混在一个区块](#h-02)
- [H-03 P3｜预警和管道给出结果，却缺少直接处理入口](#h-03)

### 订单（7项）

- [O-01 P2｜付款、运费、缺货保存先关闭表单，失败后难以继续原输入](#o-01)
- [O-02 P2｜已保存但详情刷新失败，会被统一报告为操作失败](#o-02)
- [O-03 P2｜列表快捷状态操作忽略当前权限，与详情内权限行为不一致](#o-03)
- [O-04 P2｜查指定订单要逐页找，已有搜索/日期/客户/排序接口未暴露到 UI](#o-04)
- [O-05 P3｜日常打印/处理只能逐单打开，缺少批量准备入口](#o-05)
- [O-06 P2｜缺货登记关键流程写死中文，意大利语页面仍无法读懂](#o-06)
- [O-07 P3｜手机操作阶段和待办筛选横向隐藏，缺少提示](#o-07)

### 商品与目录（8项）

- [P-01 P3｜商品下的五个工作区跨了多种日常任务](#p-01)
- [P-02 P3｜商品详情六页签采用660px隐藏滚动条](#p-02)
- [P-03 P2｜Excel导入关闭会直接清空文件、粘贴和预览](#p-03)
- [P-04 P2｜导入预览只显示部分字段名，缺少完整旧值→新值](#p-04)
- [P-05 P2｜商品审计每条只显示前6个变化，没有展开](#p-05)
- [P-06 P3｜目录排序需逐项输数字，手机编辑区在列表后方](#p-06)
- [P-07 P3｜批次详情在小平板就启用1180px宽表格](#p-07)
- [P-08 P3｜商品编辑的兼容性提示直接显示内部规则码](#p-08)

### 缺货与补货（3项）

- [I-01 P2｜缺货和补货队列最多50条，导出也只用当前数组](#i-01)
- [I-02 P2｜库存体检只展示前8项，没有查看全部问题入口](#i-02)
- [I-03 P3｜补货计划主要逐行加入、修改和保存](#i-03)

### 售后（4项）

- [R-02 P2｜售后每个队列固定前80条，缺少继续浏览入口](#r-02)
- [R-03 P2｜售后详情缺少客户原始故障原因和原始描述](#r-03)
- [R-07 P3｜手机六阶段栏的后半段缺少可发现的入口](#r-07)
- [R-08 P3｜手机空队列仍保留大块空白详情占位](#r-08)

### 账号（6项）

- [A-01 P2｜账号编辑对话框关闭直接销毁草稿，提交中也没有关闭拦截](#a-01)
- [A-02 P2｜想修一个电话也必须先补全整份档案，表单未按任务拆分](#a-02)
- [A-03 P2｜有效权限只展示前 24 个，+N 无展开动作](#a-03)
- [A-04 P2｜员工角色调整只选名称，缺少权限变化预览](#a-04)
- [A-05 P2｜“历史订单”实际只取最近 20 条，还没有进入订单处理的链接](#a-05)
- [A-06 P2｜账号面板主要操作和反馈写死中文，当前 i18n 只覆盖少量角色标签](#a-06)

### 财务（8项）

- [F-01 P1｜财务逗号小数输入会发出null，API金额校验可将其转换为0](#f-01)
- [F-02 P2｜付款时间默认取 UTC 文本，再作为本地时间提交，罗马时区偏移](#f-02)
- [F-03 P2｜记供应商付款时，批次下拉受报表筛选控制](#f-03)
- [F-04 P2｜财务明细固定取默认 50 条，没有分页或总数说明](#f-04)
- [F-05 P2｜记错费用/付款后页面没有修正入口，已有 PATCH 接口未接入](#f-05)
- [F-06 P2｜错误被替换为泛化消息，明细失败又渲染“无数据”](#f-06)
- [F-07 P2｜财务只读员工仍看到新增费用/付款按钮](#f-07)
- [F-08 P2｜手机财务多行页签高度没有撑开，覆盖下方卡片](#f-08)

### 电商（6项）

- [E-01 P2｜eBay未保存设置时也可以生成计划，后续刷新会覆盖草稿](#e-01)
- [E-02 P2｜eBay缺少连接和就绪的逐步引导](#e-02)
- [E-03 P3｜eBay手机四张统计卡占满首屏](#e-03)
- [E-04 P3｜eBay映射在手机仍是多列可编辑宽表](#e-04)
- [E-05 P2｜执行队列一次只处理5条，缺少继续处理的明确路径](#e-05)
- [E-06 P2｜eBay整页主要写死中文和技术英文](#e-06)

### 客服（3项）

- [S-01 P1｜回复草稿跨会话保留，可能发送给另一客户](#s-01)
- [S-02 P2｜客服队列固定50/100条，没有搜索和翻页](#s-02)
- [S-03 P2｜切换会话读取失败时，旧详情仍留在回复区域](#s-03)

### 活动记录（2项）

- [M-01 P2｜活动时间线没有接入真实活动源](#m-01)
- [M-02 P3｜手机隐藏了本地备注的说明，刷新会丢便签](#m-02)

### 设置权限（3项）

- [T-01 P2｜权限矩阵点一次就立即生效，缺少变更差异核对](#t-01)
- [T-02 P3｜后台设置外层中文，内部权限页却随语言切换](#t-02)
- [T-03 P3｜手机员工列表用大块最小高度，少量员工时空白很大](#t-03)

### REMAX（2项）

- [X-01 P3｜REMAX后台从总览快捷链接进入，缺统一模块导航和语言](#x-01)
- [X-02 P2｜REMAX待处理预订单只列前8条，没有查看全部入口](#x-02)

## 全部问题明细

## 通用导航

<a id="g-01"></a>

### G-01 [P2] 顶部全局搜索框没有搜索行为

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 顶部输入框写着搜索订单、SKU、客户，但没有value/onChange、提交处理或结果区；和页面内搜索并存。

**操作影响：** 员工在最显眼的入口输入后无法查到内容，尤其订单页本身又缺查询控件。

**建议简化/修正：** 接入统一搜索，分订单/商品/客户显示匹配结果并直达详情；交付前移除可输入但无行为的状态。

**证据：** 线上控件可见 + 发布源码确认。 [admin-dashboard.tsx:781](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:781>)

**验收：** 输入订单号、SKU、客户关键字能分别定位；无匹配、加载、失败有明确反馈。

<a id="g-02"></a>

### G-02 [P2] 短屏桌面侧栏的账号区覆盖底部菜单

**设备适用：** 桌面短屏，重点1280×568；手机抽屉不按同一遮挡结论判定。

**现象：** 侧栏固定h-screen，导航没有自身滚动，账号卡absolute bottom-4。线上1280×568中账号区y=483–552，财务y=480–520、统计y=524–564，设置y=568–608。合成组件也复现统计/设置与底部卡重叠。

**操作影响：** 浏览器窗口较矮或缩放后，菜单被遮挡或落到视口外；这是本次明确复现的实际遮挡。

**建议简化/修正：** 侧栏改成顶部品牌、可滚动导航、底部账号三个flex区域；底部卡不要覆盖导航流。

**证据：** 线上几何读取与截图 + 合成组件复现。 [admin-dashboard.tsx:560](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:560>)、[admin-dashboard.tsx:675](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:675>)

**验收：** 1280×568、1280×720及展开/折叠两状态，所有菜单均可滚动到并点击，账号区无覆盖。

<a id="g-03"></a>

### G-03 [P2] 营销入口实际进入运营时间线

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 导航营销对应timeline，内容是后台活动时间线和本地备注。

**操作影响：** 想找促销、活动、客户触达的人进入了日志页，查操作记录的人又不会自然选择营销。

**建议简化/修正：** 将入口改名为活动记录/运营日志；真实营销功能有明确范围时独立进入。

**证据：** 线上入口与发布源码一致。 [admin-dashboard.tsx:97](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:97>)、[admin-activity-timeline.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:120>)

**验收：** 菜单名称、标题和实际主任务一致。

<a id="g-04"></a>

### G-04 [P2] 网站统计入口长期可见但始终禁用

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 发布基准navItems中的reports没有panel；可用性依赖panel，因此按钮禁用。正式Dashboard也没有analytics的TabsContent。主目录有后续统计候选，不能代表正式入口已接入。

**操作影响：** 用户无法知道是没权限、未连接还是功能未上线，反复尝试无意义。

**建议简化/修正：** 接入已具备权限和数据的统计页面；尚未接入时显示明确未开放说明或隐藏入口。

**证据：** 线上disabled状态 + 发布源码确认。 [admin-dashboard.tsx:99](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:99>)、[admin-dashboard.tsx:459](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:459>)

**验收：** 有权限账号能够进入；无权限与未配置分别解释。

<a id="g-05"></a>

### G-05 [P3] 底部账号卡像下拉菜单但没有操作

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 卡片显示固定Admin/管理员及ChevronDown，实际只是div，身份也未使用当前账号信息。

**操作影响：** 视觉上暗示可以展开账号操作，点击无反应；员工无法从此确认当前身份。

**建议简化/修正：** 使用当前账号名称与角色；需要展开就接真实账号菜单，纯身份展示则去掉下拉箭头。

**证据：** 发布源码确认。 [admin-dashboard.tsx:537](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:537>)

**验收：** 卡片交互、箭头和键盘语义一致；展示当前身份。

<a id="g-06"></a>

### G-06 [P3] 侧栏默认折叠且不保存用户选择

**设备适用：** 桌面侧栏展开/收起与刷新；手机抽屉保持独立使用方式。

**现象：** 折叠状态每次初始化为true，展开/收起没有持久化；折叠仅靠图标和悬停提示。

**操作影响：** 新员工要反复辨认图标；刷新或重新进入后又需展开。

**建议简化/修正：** 默认按设备宽度/首次使用展示适当状态，保存个人展开偏好，首次保留名称更容易学习。

**证据：** 发布源码确认。 [admin-dashboard.tsx:277](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:277>)

**验收：** 刷新后保持用户选择；首次用户能辨认各业务入口。

<a id="g-07"></a>

### G-07 [P2] 跨模块返回缺少稳定的筛选、页码和选中上下文

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 一级切换用router.replace；TabsContent按活动页装卸载，各列表主要把筛选和页码保存在组件state，商品URL只同步workspace/sku等局部信息。

**操作影响：** 从客户到订单、从缺货到商品后难回到原位置；浏览器返回不形成逐页处理路径。

**建议简化/修正：** 把可恢复查询状态存URL/会话，提供带来源的返回；关键定位用push，筛选内部才按需要replace。

**证据：** 发布源码确认；跨模块完整真实账号流程未逐项复验。 [admin-dashboard.tsx:381](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:381>)、[admin-dashboard.tsx:463](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:463>)、[admin-products-panel.tsx:1806](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:1806>)

**验收：** 筛选第3页→详情/别模块→返回，筛选、页码、选择和滚动位置恢复。

<a id="g-08"></a>

### G-08 [P3] 顶栏始终写运营后台，没有当前位置

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** activePanel传给Topbar用于菜单，但标题始终使用固定text.topbar.title/subtitle；主要模块依赖内容区标题再次说明。

**操作影响：** 收起侧栏或长页滚动时，不容易判断当前模块及来源。

**建议简化/修正：** 顶栏增加当前模块/子页名称和简短返回路径，固定宣传副标题缩减。

**证据：** 线上多页观察 + 发布源码确认。 [admin-dashboard.tsx:769](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:769>)

**验收：** 长页滚动与手机菜单关闭后仍能知道当前模块。

<a id="g-09"></a>

### G-09 [P3] 部分可见字段标签未与输入控件关联

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 财务多处Label没有htmlFor且输入没有id；eBay和REMAX的Field也把Label与输入作为相邻元素。

**操作影响：** 点击标签不能聚焦输入，屏幕阅读器难以辨识；密集表单里更易填错相邻字段。

**建议简化/修正：** 统一Field生成id/htmlFor或明确aria-labelledby；图标操作补aria-label，不能只用title。

**证据：** 发布源码确认；财务模拟界面已查看。 [admin-finance-panel.tsx:701](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:701>)、[admin-marketplace-panel.tsx:999](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:999>)、[admin-remax-center.tsx:460](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:460>)

**验收：** 标签点击聚焦对应字段；键盘/读屏能读出金额、IVA、政策ID等名称。

## 总览

<a id="h-01"></a>

### H-01 [P2] 总览的大数字依赖100条样本，容易被当成全站统计

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** overview API只读取最近100单和最近更新100商品再聚合。线上标题小字有100/185、100/17976等范围，大卡片仍叫库存预警/活跃SKU/待收款；数值不是完整库存与订单总量。

**操作影响：** 补货和经营判断可能基于有限样本；长期间趋势也可能缺早期订单。

**建议简化/修正：** 全站KPI用服务端完整聚合；暂用样本时每张卡显著标注样本统计、覆盖时间和范围，并链接完整清单。

**证据：** 线上范围提示 + 发布API/聚合源码确认，未读数据库全量进行对账。 [route.ts:95](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/overview/route.ts:95>)、[route.ts:121](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/overview/route.ts:121>)、[admin-overview-dashboard.tsx:162](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:162>)

**验收：** 超过100条合成订单/商品时，全局KPI与完整聚合一致；样本指标清楚单列。

<a id="h-02"></a>

### H-02 [P3] 30/90天图表与旁边7日指标混在一个区块

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 趋势下拉有7/30/90天，旁边MiniKpi仍固定sales7d/paidOrders7d/averageOrder7d。标签确实写7日，数值本身未被证明错误。

**操作影响：** 同一区块切换30天后仍展示7日小计，容易误以为筛选同时作用于旁边金额。

**建议简化/修正：** 把旁边KPI改为当前图表期间，或明显分开固定7日指标并说明控件范围。

**证据：** 发布源码确认；属于信息组织优化。 [admin-overview-dashboard.tsx:412](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:412>)、[admin-overview-dashboard.tsx:425](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:425>)

**验收：** 切换30/90天后数据口径和文案清楚。

<a id="h-03"></a>

### H-03 [P3] 预警和管道给出结果，却缺少直接处理入口

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 热门库存预警、订单管道主要显示卡片/状态汇总，主要快捷处理只有处理订单、查看商品和时间线。

**操作影响：** 看见具体缺货SKU或某阶段数量后仍需去列表再定位。

**建议简化/修正：** 具体预警链接到该SKU/补货；阶段数量直达预筛选订单列表，保留来源返回。

**证据：** 发布源码确认 + 总览线上观察。 [admin-overview-dashboard.tsx:447](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:447>)、[admin-overview-dashboard.tsx:606](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-overview-dashboard.tsx:606>)

**验收：** 任一预警/阶段可一步进入对应范围。

## 订单

<a id="o-01"></a>

### O-01 [P2] 付款、运费、缺货保存先关闭表单，失败后难以继续原输入

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 付款提交调用 void 回调后立即 `setDialogOpen(false)`；运费同样立即关闭；缺货提交后将 `editingLine` 清空。付款/运费重新打开会从旧订单数据重新初始化草稿；缺货重新打开也重置原因。员工备注保存也在请求结果前退出编辑。

**操作影响：** 网络/校验失败后用户只见面板层错误，须重新找到编辑入口并重填；付款、运费和缺货都是需要仔细核对的输入。

**建议简化/修正：** 保存回调返回结果，保持对话框与输入至保存成功；失败信息放在表单内，并可在原字段直接更正。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:3558](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:3558>)

**验收：** 模拟 400、403、超时，输入、当前订单和焦点均保留；成功时关闭。

<a id="o-02"></a>

### O-02 [P2] 已保存但详情刷新失败，会被统一报告为操作失败

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** PATCH 成功并 upsert 返回订单后，还在同一个 try 内等待详情 GET；GET 失败进入同一 catch，展示 rejected/error。

**操作影响：** 员工不知道是否已保存，容易重复操作，尤其对收款核对和退款类金额操作不利。

**建议简化/修正：** 分别报告“保存已完成”和“详情刷新失败”；仅提供重读按钮，保留已返回状态，并避免让用户重新提交。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:842](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:842>)

**验收：** 成功写入后只读刷新失败不会显示“保存失败”，也不会丢掉返回记录。

<a id="o-03"></a>

### O-03 [P2] 列表快捷状态操作忽略当前权限，与详情内权限行为不一致

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** OrdersList props 没有权限参数，依据订单状态生成 transition，按钮只检查 isMutating；handleQuickTransition/handleTransition 没有 orders.manage 检查。详情却明确计算并使用 orders.manage。

**操作影响：** 只读员工在列表看到可操作按钮，点击后才被服务器拒绝，既浪费操作也降低对权限的理解。

**建议简化/修正：** 列表使用相同 capability，只读账号显示详情；有状态但无权限时说明需要哪项权限。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:1796](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1796>)

**验收：** 只读角色列表无可点击写入快捷动作，详情与列表一致。

<a id="o-04"></a>

### O-04 [P2] 查指定订单要逐页找，已有搜索/日期/客户/排序接口未暴露到 UI

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 面板只有订单/收款/配送视图和工作流筛选，没有订单号/客户文本搜索、日期范围或排序控件；fetchOrders 固定 `sort=operations_queue`，未接 q、customerId、dateFrom/dateTo。分页只有上一页/下一页。

**操作影响：** 客服按客户电话/订单号追查、查某天收款或旧订单，需要多次翻页；当前工作队列排序不适合所有查询目的。

**建议简化/修正：** 一行提供订单号/客户搜索和日期，排序放“更多筛选”；显示活动筛选并可一键清除；保留当前工作队列默认。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:5888](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:5888>)、[_schemas.ts:25](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/orders/_schemas.ts:25>)

**验收：** 输入精确订单号可以定位，返回列表仍保留筛选/页码。

<a id="o-05"></a>

### O-05 [P3] 日常打印/处理只能逐单打开，缺少批量准备入口

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 列表无选择列/多选状态，行操作只有下一状态与详情；打印只在单个订单 ActionBar 中执行。

**操作影响：** 打印多单拣货单、连续检查同阶段订单要反复打开/关闭详情，批量作业步骤随订单量线性增加。

**建议简化/修正：** 先增加低风险的多选批量打印和“处理下一单”；如未来增加批量状态变更，逐单检查资格、预览范围并逐项展示结果，不能跳过库存/付款校验。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:1680](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1680>)

**验收：** 选中 5 单可一次生成打印预览，连续查看不丢列表筛选。

<a id="o-06"></a>

### O-06 [P2] 缺货登记关键流程写死中文，意大利语页面仍无法读懂

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 缺货 Dialog 的标题、默认全货说明、实际给货数量、数量提醒、退款流程说明、原因 placeholder 和保存按钮都未使用 text/locale。

**操作影响：** 意大利员工在最需要准确理解少给数量和退款后果的地方遇到中文，可能误填或无法独立处理。

**建议简化/修正：** 整段纳入当前后台词典，并将“实际给货数量”“将少给几件”“将创建退款申请”作为统一预览。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-orders-panel.tsx:4692](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:4692>)

**验收：** 该 Dialog 无中文残留，数量和退款影响在两种语言一致。

<a id="o-07"></a>

### O-07 [P3] 手机操作阶段和待办筛选横向隐藏，缺少提示

**设备适用：** 手机阶段和待办入口，360/390宽度。

**现象：** 360像素意大利语下，只看到全部订单、新订单和部分已接单；Picking/已打包/已发货、超期锁货在横向滚动区后方。

**操作影响：** 新用户可能不知道还有后续阶段；触屏需要横滑，查阶段的步骤变多。

**建议简化/修正：** 提供带全部选项的阶段下拉或折叠更多筛选，保留当前阶段标签；如继续横滑，加渐隐/箭头/可见滚动线索。

**证据：** 真实组件360意大利语截图与几何确认；这是容器内横向滚动，不是整页错位。 [admin-orders-panel.tsx:1278](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-orders-panel.tsx:1278>)

**验收：** 手机可以发现并进入最后一个阶段及待办筛选。

## 商品与目录

<a id="p-01"></a>

### P-01 [P3] 商品下的五个工作区跨了多种日常任务

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 商品目录、近期售出缺货、到货批次、首页横幅、目录管理同级排在商品内部；价格活动又在账号页折叠面板，REMAX是独立页。

**操作影响：** 管理员需要记住功能藏在哪个模块，尤其首页横幅/价格活动和业务归属不直观。

**建议简化/修正：** 按商品、采购库存、客户价格、内容运营组织入口；保留原URL兼容和常用快捷入口，不必一次重构所有页面。

**证据：** 线上与模拟五页签观察 + 发布源码。 [admin-products-panel.tsx:2394](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:2394>)、[admin-accounts-panel.tsx:938](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:938>)

**验收：** 新员工可按业务任务快速找到横幅、批次、补货和价格检查。

<a id="p-02"></a>

### P-02 [P3] 商品详情六页签采用660px隐藏滚动条

**设备适用：** 移动端商品详情页签；桌面宽屏主要是信息分组问题。

**现象：** 详情页签容器overflow-x-auto，同时隐藏滚动条，内部min-width660px；手机无法同时看到库存、媒体、兼容与审计。

**操作影响：** 后半段功能存在但难发现，常要左右来回拖动。

**建议简化/修正：** 手机使用下拉/分组导航，或保留可见横滑提示和当前页定位；编辑阶段锁定其他页签时解释原因。

**证据：** 发布源码确认，商品详情合成页面已打开并查看；390px只显示前三项，全部6项保留在横滑区域。 [admin-products-panel.tsx:7339](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:7339>)

**验收：** 390px可发现和进入全部6页签，状态锁定有说明。

<a id="p-03"></a>

### P-03 [P2] Excel导入关闭会直接清空文件、粘贴和预览

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** handleOpenChange(false)无脏数据/处理中检查，立即清空file、pasteText、preview、确认项、pending和结果。

**操作影响：** 误按Esc/关闭可丢大量准备工作；处理中关闭使结果不容易回看。

**建议简化/修正：** 有草稿离开提示保存/放弃；处理中阻止关闭或明确后台任务与可恢复结果；失败保留源和预览。

**证据：** 发布源码确认；本次未真实导入。 [admin-product-import-dialog.tsx:107](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:107>)

**验收：** 粘贴长表/已生成预览后关闭有保护；处理中不丢任务结果。

<a id="p-04"></a>

### P-04 [P2] 导入预览只显示部分字段名，缺少完整旧值→新值

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 桌面changes只显示前3个字段名和+N，手机只显示变更数量；此处没有展开完整差异或逐字段对比的按钮。

**操作影响：** 批量更新前不能在预览中充分核对究竟改哪些值，价格/型号变更尤其需要清楚。

**建议简化/修正：** 每行可展开完整旧值、新值与规则说明；批量只读检查聚焦阻断/价格/兼容变化，保留现有人工确认。

**证据：** 发布源码确认，未执行应用。 [admin-product-import-dialog.tsx:436](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:436>)、[admin-product-import-dialog.tsx:450](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-product-import-dialog.tsx:450>)

**验收：** 多于3项变更可全部查看，数量与实际差异一致。

<a id="p-05"></a>

### P-05 [P2] 商品审计每条只显示前6个变化，没有展开

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** auditChangeItems(...).slice(0,6)后直接渲染，没有剩余数量或查看完整差异入口。

**操作影响：** 一个多字段编辑事件的后续变化会看不到，排查误改需要另找资料。

**建议简化/修正：** 默认前6项并明确+N可展开完整事件；敏感金额/身份字段优先显示。

**证据：** 发布源码确认。 [admin-products-panel.tsx:8434](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:8434>)

**验收：** 单次事件8项变化均可查看，默认摘要与完整明细一致。

<a id="p-06"></a>

### P-06 [P3] 目录排序需逐项输数字，手机编辑区在列表后方

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 目录编辑要求逐项选择、输入position并保存；窄屏采用上下布局，列表自身又可滚动，选择后需定位下方编辑区。已有自动scrollIntoView。

**操作影响：** 调多个分类顺序时重复操作；查看列表和编辑表单之间上下跳转。

**建议简化/修正：** 同列表提供上移/下移或拖动的待保存排序，手机用编辑抽屉；统一预览后保存，保留版本冲突校验。

**证据：** 发布源码确认 + 手机目录组件查看；不把已有自动滚动列为缺失。 [admin-catalog-directory.tsx:84](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-catalog-directory.tsx:84>)、[admin-catalog-directory.tsx:103](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-catalog-directory.tsx:103>)

**验收：** 调整5项顺序能一次核对提交，冲突时草稿保留。

<a id="p-07"></a>

### P-07 [P3] 批次详情在小平板就启用1180px宽表格

**设备适用：** 桌面及平板批次宽表；手机另有卡片表现，未把手机当作同一宽表故障。

**现象：** 批次明细sm断点即切到桌面表格，min-width1180px，9列百分比宽度还合计117%另加序号列。

**操作影响：** 640–1024px平板需要大量横滑，成本/库存/问题不在同一视野；百分比需浏览器重分配。

**建议简化/修正：** 表格断点按真实容纳宽度调整，平板用行展开/列选择；固定关键商品/数量列，把成本附加字段放明细。

**证据：** 源码确认；满列真实批次样本尚未浏览器复现，列挤压属于待复验候选。 [admin-products-panel.tsx:4034](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:4034>)

**验收：** 768/1024和长商品名、有运输成本样本下列关系可读，标题与单元格对齐。

<a id="p-08"></a>

### P-08 [P3] 商品编辑的兼容性提示直接显示内部规则码

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 兼容复核提示把review.reasonCodes.join传给用户，并展示结构化字段说明；模拟长名称商品出现MULTI_MODEL_TITLE/STRUCTURED_MODELS_INCOMPLETE等英文规则码。

**操作影响：** 店员需要理解技术字段才能完成商品编辑，问题与纠正步骤不够直接。

**建议简化/修正：** 把规则码映射成业务说明和可点击修正字段，内部码折叠到技术详情；保留兼容性人工审核。

**证据：** 发布源码 + 合成编辑界面观察，未进行兼容写入。 [admin-products-panel.tsx:6841](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-products-panel.tsx:6841>)

**验收：** 明确告诉用户识别到哪些候选、缺哪些字段、如何修正或确认。

## 缺货与补货

<a id="i-01"></a>

### I-01 [P2] 缺货和补货队列最多50条，导出也只用当前数组

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 三个库存请求均limit50，没有offset推进控件；exportCsv/exportPurchaseCsv对已读取rows/items生成文件。

**操作影响：** 大量SKU或采购行时，界面与导出不包含后面的条目，导出按钮未充分说明范围。

**建议简化/修正：** 补分页/游标，导出明确本页/全部匹配/已选；完整导出由受控只读接口按同筛选生成。

**证据：** 发布源码确认，模拟空状态已检查；未导出真实库存。 [admin-inventory-panel.tsx:267](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:267>)、[admin-inventory-panel.tsx:416](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:416>)

**验收：** 51+条样本可访问和导出；导出数量、范围明确。

<a id="i-02"></a>

### I-02 [P2] 库存体检只展示前8项，没有查看全部问题入口

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 体检表rows.slice(0,8)；摘要可显示更多异常数，但表格末尾没有加载更多或完整问题列表链接。

**操作影响：** 工作人员看到问题总数后无法逐条追查剩余异常。

**建议简化/修正：** 增加查看全部异常并预填类型/严重度；首屏保留8项高优先级摘要。

**证据：** 发布源码确认。 [admin-inventory-panel.tsx:1141](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1141>)

**验收：** 9+异常可以逐项定位，摘要与列表范围清楚。

<a id="i-03"></a>

### I-03 [P3] 补货计划主要逐行加入、修改和保存

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 缺货行逐行加入队列；队列编辑供应商、数量、备注后逐行保存，状态选择又直接单条PATCH。

**操作影响：** 处理几十件同供应商补货要反复点击，且保存资料与改变状态的时机不一致。

**建议简化/修正：** 多选形成采购草案；同供应商批量填写、统一预览与保存，状态推进逐项检查并显示部分失败。

**证据：** 发布源码确认，尚未模拟批量功能。 [admin-inventory-panel.tsx:942](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:942>)、[admin-inventory-panel.tsx:1330](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1330>)、[admin-inventory-panel.tsx:1380](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-inventory-panel.tsx:1380>)

**验收：** 10条补货统一核对后提交，失败行明确且不重复已成功项。

## 售后

<a id="r-02"></a>

### R-02 [P2] 售后每个队列固定前80条，缺少继续浏览入口

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 正式版本仍固定limit=80、offset=0，列表没有分页或加载更多。新版已有完整/部分计数和≥标记，计数说明已改善；剩余问题是第81条的浏览入口。

**操作影响：** 一个阶段超过80条时，无法从当前队列继续翻查后面的申请，可能遗漏待处理事项。

**建议简化/修正：** 提供分页/加载更多并显示当前返回/总数；保持选中记录和草稿，允许直接按RMA/订单号定位。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-rma-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:430>)

**验收：** 第81条可访问，筛选后总数/已显示数准确。

<a id="r-03"></a>

### R-03 [P2] 售后详情缺少客户原始故障原因和原始描述

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 正式版本已展示requestedResolution、换货订单及后台处理备注，但没有消费客户原始reason、reasonCode、description。repository把这些字段和customerVisibleNote从独立列映射，后台处理备注不能保证等同于原始申请。

**操作影响：** 审核人员要判断故障、核对附件时，同页可能缺少客户最初写下的文字；有描述的真实样本仍需进一步只读核对。

**建议简化/修正：** 把原始故障原因、客户原文、申请数量和附件放在详情顶部的只读申请卡；现有诉求、推荐动作和换货/协商分支继续复用。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-rma-panel.tsx:983](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:983>)、[partspro-repository.ts:16190](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:16190>)

**验收：** 合成reason/description与customerVisibleNote不同的申请，详情完整显示原始申请，且后台备注分组明确。

<a id="r-07"></a>

### R-07 [P3] 手机六阶段栏的后半段缺少可发现的入口

**设备适用：** 手机售后阶段导航，390宽度与360意文。

**现象：** 390手机首屏主要见审核、待寄回、收货中及部分质检，结算和库存关闭需要横滑；阶段条没有明显滚动提示。

**操作影响：** 当前已在后期处理的申请不容易直接找到。

**建议简化/修正：** 阶段下拉/更多阶段入口，或保留横向栏并提示剩余阶段。

**证据：** 线上390视口 + 当前组件截图/几何确认。 [admin-rma-panel.tsx:755](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:755>)

**验收：** 不用试探就能知道六阶段齐全，并切换到库存关闭。

<a id="r-08"></a>

### R-08 [P3] 手机空队列仍保留大块空白详情占位

**设备适用：** 手机空队列；桌面双栏的正常占位需要单独判断。

**现象：** 没有申请或未选择记录时，列表下方仍显示很高的空详情面板，短屏大部分空间只写选择一条申请。

**操作影响：** 首屏有效内容少；用户会继续滚动寻找实际上不存在的详情。

**建议简化/修正：** 空队列时收起详情占位，只保留一行说明；有记录手机打开详情抽屉/独立详情页。

**证据：** 线上空队列截图 + 模拟空状态确认。 [admin-rma-panel.tsx:845](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-rma-panel.tsx:845>)

**验收：** 空队列手机不出现大块无任务区域；有记录能自然进入详情。

## 账号

<a id="a-01"></a>

### A-01 [P2] 账号编辑对话框关闭直接销毁草稿，提交中也没有关闭拦截

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 三个 Dialog 的 onOpenChange 直接调用 onClose；父组件 onClose 直接清空 conversion、customerAction、profileEditor。取消按钮禁用 submitting，但 Dialog 关闭回调没有同样保护。

**操作影响：** 误触遮罩/Esc/关闭可丢掉较长地址和审计原因；提交期间关闭后无法在原表单查看失败并继续修改。

**建议简化/修正：** 脏草稿离开时提示保存/放弃，并将提交中状态应用到所有关闭路径；失败在当前表单内说明。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1131](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1131>)、[admin-accounts-panel.tsx:2186](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2186>)

**验收：** 修改多个地址字段后意外关闭有保护；提交中不允许销毁输入。

<a id="a-02"></a>

### A-02 [P2] 想修一个电话也必须先补全整份档案，表单未按任务拆分

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** canSubmit 同时强制客户名、电话、税号、配送地址、账单地址完整和至少三字原因；编辑区始终显示完整资料及地址。

**操作影响：** 历史资料不完整时，修电话/PEC 等单项也会被无关缺失字段阻止，需要一次处理很多信息。

**建议简化/修正：** 把“补全资料用于购买”与“修正已知字段”分开；字段级修正只提交变化内容并审计，订单使用资格仍由完整资料校验守住。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:2427](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2427>)

**验收：** 合成缺地址客户仍可修非地址信息；checkout 完整性规则保持有效。

<a id="a-03"></a>

### A-03 [P2] 有效权限只展示前 24 个，+N 无展开动作

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** `detail.permissions.slice(0,24)`，超过 24 后只渲染普通 Badge `+N`，没有点击或展开入口；详情头部又显示完整权限数量。

**操作影响：** 审核员工能不能执行特定操作时，看不到第 25 项以后的具体权限，权限标签的顺序会决定是否可查。

**建议简化/修正：** 展示全部可搜索权限，默认按业务域折叠；+N 改为“查看全部”并可聚焦查询。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1991](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1991>)

**验收：** 任意权限均可在详情查询到，数量与列表一致。

<a id="a-04"></a>

### A-04 [P2] 员工角色调整只选名称，缺少权限变化预览

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** RoleTemplate 包含 permissions/description，但角色 Dialog 只渲染 roleTemplateLabel，随后填写原因并保存；没有当前/目标权限差集或目标职责说明。

**操作影响：** 管理员必须凭记忆知道角色名称的实际权限，难以在保存前识别敏感权限新增或原权限撤销。

**建议简化/修正：** 在同一 Dialog 展示目标角色说明及新增/移除权限摘要，敏感权限显著标记；无需多开另一个页面查。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:2203](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2203>)

**验收：** 切换角色可直接看到差异，缺模板数据时不给一个看似可靠的默认角色选择。

<a id="a-05"></a>

### A-05 [P2] “历史订单”实际只取最近 20 条，还没有进入订单处理的链接

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 账号 API 的 ledger RPC 使用 p_order_limit:20，fallback 同样 limit(20)；UI 标題“历史订单”后只 map，没有分页、加载更多或近期限制提示；订单号是普通 div，消费明细同样是 span。

**操作影响：** 用户以为能查看完整历史，却无法找到更早订单；找到问题单后仍需离开账号，再去订单后台重新定位。

**建议简化/修正：** 明确“最近20单”，提供“全部订单”入口并预填 customerId，列表订单号直接打开对应详情；保持返回客户上下文。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1864](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1864>)、[_account-data.ts:1039](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/accounts/_account-data.ts:1039>)

**验收：** 21+ 单合成客户可查到旧单，点击订单可进入处理并返回当前账号。

<a id="a-06"></a>

### A-06 [P2] 账号面板主要操作和反馈写死中文，当前 i18n 只覆盖少量角色标签

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 标题辅助、刷新、账号切换、搜索、空状态、变更/编辑表单、成功反馈均有直接中文；组件虽使用 useAdminText，但这些区域没有使用词典。

**操作影响：** 意大利员工难以管理账号、完整理解角色转换和资料变更，和订单/财务/RMA 的语言体验不一致。

**建议简化/修正：** 统一后台词典，优先覆盖身份变更、权限、保存结果与校验文案；地址术语保留意大利字段名并给清晰说明。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-accounts-panel.tsx:1002](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:1002>)、[admin-accounts-panel.tsx:2188](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-accounts-panel.tsx:2188>)

**验收：** 账号全部常用操作、校验、成功/失败消息跟随当前语言。

## 财务

<a id="f-01"></a>

### F-01 [P1] 财务逗号小数输入会发出null，API金额校验可将其转换为0

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 金额/IVA Input 是文本，仅 inputMode=decimal；提交使用 Number，没有规范化逗号和有限数校验。`Number("12,50")` 为 NaN，JSON.stringify 发送 null，而当前 `z.coerce.number().nonnegative()` 把 null 转成 0。

**操作影响：** 输入习惯上正常的 €12,50 可能变成 €0，而不是字段级拒绝；这比普通保存失败严重。最终真实数据库是否允许此行，本次未写库验证。

**建议简化/修正：** 统一金额解析器接受当地小数格式，提交前要求 finite/合法精度；API 禁止 null/coercion 将缺失或非法值变成 0；显示净额、IVA、总额预览。

**证据：** 发布基准源码确认 + 真实组件/模拟接口交互复现：输入12,50，浏览器请求的amountNet为null；本地Zod表达式把null解析为0。未向真实数据库保存。 [admin-finance-panel.tsx:650](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:650>)、[_shared.ts:37](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/_shared.ts:37>)、[partspro-repository.ts:8456](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/lib/partspro-repository.ts:8456>)

**验收：** 12,50、12.50、空字符串、非法文本、负数都按明确规则解析/拒绝；金额不静默变 0。

<a id="f-02"></a>

### F-02 [P2] 付款时间默认取 UTC 文本，再作为本地时间提交，罗马时区偏移

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** paidAt 初值及保存后重置用 `new Date().toISOString().slice(0,16)`，datetime-local 显示该值，提交再用 `new Date(form.paidAt).toISOString()`。日期 todayDate 也使用 UTC 切片。

**操作影响：** 欧洲夏令时默认付款时刻可能早两小时，冬季早一小时；本地午夜后的 date 默认可能仍是前一天，影响对账日期。

**建议简化/修正：** datetime-local 用本地年月日时分生成，只在提交时转换 UTC；日期字段使用用户本地日期。

**证据：** 发布基准源码确认 + Europe/Rome本地时区转换复现；未做真实记账。 [admin-finance-panel.tsx:744](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:744>)

**验收：** Europe/Rome 夏令/冬令及午夜边界，默认值保存后保持同一时刻/日期。

<a id="f-03"></a>

### F-03 [P2] 记供应商付款时，批次下拉受报表筛选控制

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** batchOptions 来自当前 ledgerRows 的 purchase 项并 slice(0,80)，该 ledgerRows 与全部报表筛选共用；付款保存必须有 batchId。

**操作影响：** 正在查看费用/某供应商/近期报表时，想给旧批次付款，目标可能完全不出现在下拉；用户得先退出或重置报表筛选才能记账。

**建议简化/修正：** 付款 Dialog 独立按供应商/批次搜索并获取未结清批次；提供欠款余额、最近付款和付款后余额预览，不依赖当前报表可见行。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:257](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:257>)

**验收：** 报表设费用分类时仍可选任意合法待付批次。

<a id="f-04"></a>

### F-04 [P2] 财务明细固定取默认 50 条，没有分页或总数说明

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** buildFinanceParams 不设置 limit/offset；financeQuerySchema 默认 limit50 offset0；ledger API 返回 total 等 meta，但面板仅消费 data；FinanceTable/CogsTable 直接 map 无分页控件。

**操作影响：** 同一期间超过50条时，明细和报表摘要可能看起来对不上，且用户无法在页面继续查完整期间记录。

**建议简化/修正：** 消费 total/returned、增加分页或加载更多；明确显示“已显示50/总N条”，必要时“查看全部/导出”与当前筛选共用。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:236](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:236>)、[_shared.ts:13](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/_shared.ts:13>)

**验收：** 第51条可继续查询，当前显示数与完整总数清晰。

<a id="f-05"></a>

### F-05 [P2] 记错费用/付款后页面没有修正入口，已有 PATCH 接口未接入

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** FinanceTable 七列全是展示，行无详情/编辑/状态动作；所有写 UI 仅为新建。对应接口已有 expenses/[expenseId] PATCH。

**操作影响：** 录错金额/日期/备注后，员工只能从别处找修正方法，容易以新增一行来弥补错误，导致重复记录。

**建议简化/修正：** 行详情提供有权限的编辑/取消记账，清晰显示原值→新值与审计原因；金额修正保留审计，不用删除重建。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:517](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:517>)、[route.ts:15](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/api/admin/finance/expenses/[expenseId]/route.ts:15>)

**验收：** 在模拟记录上能修正日期/描述，并显示原记录、变更和保存结果。

<a id="f-06"></a>

### F-06 [P2] 错误被替换为泛化消息，明细失败又渲染“无数据”

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** loadSection 对非ok只抛 copy.loadError，不解析 API error；保存两个 Dialog 也只 alert(copy.saveError)。每次加载先清空 rows，错误只放页面顶端，而 FinanceTable/CogsTable 没有 error prop，loading结束后空数组显示 copy.empty。

**操作影响：** 用户不知道是无权限、输入不合法还是服务失败，也可能把一次请求失败理解成该期间没有记录；需要反复尝试才能排查。

**建议简化/修正：** 读取接口具体错误并匹配字段；每个明细区显示“读取失败 + 重试”，失败保留旧结果并标明旧数据，而不是变成空表。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:207](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:207>)

**验收：** 空/失败/旧结果三种状态可区分，表单能定位具体失败字段。

<a id="f-07"></a>

### F-07 [P2] 财务只读员工仍看到新增费用/付款按钮

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** AdminFinancePanel 不接权限 props，头部总是渲染 ExpenseDialog 与 SupplierPaymentDialog；read接口要求 finance.read，两个POST要求 finance.manage。

**操作影响：** 只读员工需填写完整表单后才得到泛化保存失败；权限边界在界面不可解释。

**建议简化/修正：** 按finance.manage显示/禁用写入口，并说明缺少记账权限；读取报表权限不等于可以创建流水。

**证据：** 发布基准源码确认；异常请求和真实保存未在生产复现。 [admin-finance-panel.tsx:279](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:279>)

**验收：** 只读角色可正常看报表，不能进入可提交记账表单。

<a id="f-08"></a>

### F-08 [P2] 手机财务多行页签高度没有撑开，覆盖下方卡片

**设备适用：** 手机多行页签，360意文明确复现，390及中文在修复后补验。

**现象：** 360px意大利语下，5个页签排成3行；TabsList的h-auto被公共TabsList方向高度样式影响，后两行伸出容器，Acquisti e debiti/Spese/Export覆盖下方总览区域。

**操作影响：** 页签和总览信息在同一区域叠放，页面关系混乱，触摸操作可能误判目标。

**建议简化/修正：** 像已修复的商品工作区一样明确覆盖方向高度，让多行网格撑开；页签文字可换行并设合理最小高度。

**证据：** 发布基准真实组件与对应CSS截图实际复现；线上财务手机视口未单独复验。 [admin-finance-panel.tsx:297](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-finance-panel.tsx:297>)、[tabs.tsx:25](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/ui/tabs.tsx:25>)

**验收：** 360/390中意界面五页签全部在容器内，下一内容区在最后一行后；点击每项正确进入且不覆盖卡片。

## 电商

<a id="e-01"></a>

### E-01 [P2] eBay未保存设置时也可以生成计划，后续刷新会覆盖草稿

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 修改draft后，生成计划/发布/同步按钮不检查dirty；请求只发action，不发当前草稿，成功后loadOverview从服务器重置draft。模拟把加价改为25，点击计划请求仍只有plan_listings。

**操作影响：** 用户以为计划使用刚输入的配置，实际使用已保存配置，草稿还可能被覆盖。

**建议简化/修正：** 有未保存修改时先核对并保存，或阻止动作并显示使用的配置版本；完成后保留未提交草稿。

**证据：** 发布源码 + 真实组件/模拟API交互复现。 [admin-marketplace-panel.tsx:328](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:328>)、[admin-marketplace-panel.tsx:238](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:238>)

**验收：** 未保存加价/政策/映射不能悄悄按旧设置执行，刷新不静默抹草稿。

<a id="e-02"></a>

### E-02 [P2] eBay缺少连接和就绪的逐步引导

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 未连接状态仍显示所有政策ID、映射和发布/同步入口；按钮主要依据权限和busy，无连接/字段就绪向导。

**操作影响：** 店员需了解merchantLocationKey、政策ID、成色1000等术语，缺项要到提交失败才发现。

**建议简化/修正：** 连接→读取可用业务政策→选择分类/价格→预览范围→发布，用就绪清单和下拉选择替代手抄ID。

**证据：** 线上未连接界面 + 发布源码确认；未连接真实eBay或发布。 [admin-marketplace-panel.tsx:452](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:452>)、[admin-marketplace-panel.tsx:541](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:541>)

**验收：** 未连接不能误入发布；每个缺项旁边给出可完成的下一步。

<a id="e-03"></a>

### E-03 [P3] eBay手机四张统计卡占满首屏

**设备适用：** 手机首屏布局效率，390宽度。

**现象：** 390px四张统计卡单列，连接和设置都排在其后，首屏只能看到连接卡的一部分；映射和队列更远。

**操作影响：** 常用任务大量上下滚动，空数据状态也保留同等高度。

**建议简化/修正：** 手机KPI压缩成2×2或一行摘要；连接/处理主动作前置，设置和队列分任务页签。

**证据：** 真实组件390截图确认，线上桌面布局已观察。 [admin-marketplace-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:430>)

**验收：** 390首屏能找到当前主任务入口，非关键统计不挡操作。

<a id="e-04"></a>

### E-04 [P3] eBay映射在手机仍是多列可编辑宽表

**设备适用：** 手机多列编辑映射；桌面表格本身不因此判为错位。

**现象：** 手机映射字段均在Table内，每个Input有min-w24/28/32/36等宽度；模拟390px整表约772px，成色、启用、删除都在横向后半段。

**操作影响：** 编辑同一映射要反复左右拖动，删除/启用与对应本地分类可能不在同一屏。

**建议简化/修正：** 手机改分类映射卡片/抽屉，固定分类与品牌，在一张表单里完成其他字段。

**证据：** 合成完整映射数据几何确认 + 源码；属于容器横滑，未发现整页横向溢出。 [admin-marketplace-panel.tsx:724](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:724>)

**验收：** 手机可完整核对一条映射并看到启用/删除的对象。

<a id="e-05"></a>

### E-05 [P2] 执行队列一次只处理5条，缺少继续处理的明确路径

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** runJobs请求固定limit5；界面只展示执行队列按钮与队列摘要，没有按剩余量持续处理或进度按钮。

**操作影响：** 队列较长时需要反复手动点击，也不容易判断还剩多少及失败项是否应重试。

**建议简化/修正：** 显示本轮处理/剩余/失败，提供受控继续处理或后台批次进度；重试只针对可重试项。

**证据：** 发布源码确认；未执行真实队列。 [admin-marketplace-panel.tsx:384](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:384>)

**验收：** 有12条模拟队列时明确展示每轮与剩余，并保留失败原因。

<a id="e-06"></a>

### E-06 [P2] eBay整页主要写死中文和技术英文

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 标题、设置、反馈和操作直接用中文，政策字段为英文ID，未使用后台词典。

**操作影响：** 意大利员工在切换语言后仍无法完整阅读刊登和同步操作后果。

**建议简化/修正：** 优先翻译发布、同步、取消、失败与连接步骤，再用业务名称解释政策字段；内部ID作为附加信息。

**证据：** 正式源码确认，意大利语合成页仍显示电商/eBay连接等中文。 [admin-marketplace-panel.tsx:430](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:430>)、[admin-marketplace-panel.tsx:541](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-marketplace-panel.tsx:541>)

**验收：** 意大利语下整条eBay工作流文字可读，关键动作与范围准确。

## 客服

<a id="s-01"></a>

### S-01 [P1] 回复草稿跨会话保留，可能发送给另一客户

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** reply是整个面板单一state；切换conversation只改selectedId/detailView，未按会话保存/重置。模拟在A输入草稿、切到B后，B的回复框仍保留A内容。

**操作影响：** 切换客户处理时可能把为A准备的内容误发B，属于误操作风险；本次没有发送真实或模拟消息。

**建议简化/修正：** 按conversationId存草稿；切换时加载该会话草稿，发送前核对会话ID与当前详情，必要时提醒保留草稿。

**证据：** 发布源码 + 两个合成会话交互复现。 [admin-support-panel.tsx:249](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:249>)、[admin-support-panel.tsx:637](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:637>)

**验收：** A/B互相切换只展示各自草稿；待发送内容始终绑定当前会话。

<a id="s-02"></a>

### S-02 [P2] 客服队列固定50/100条，没有搜索和翻页

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 桌面会话请求limit50 offset0，手机inbox请求limit100 offset0；页面有状态/归属筛选，没有客户/订单/内容查询或继续翻页。

**操作影响：** 会话量增加后难找旧客户咨询；手机和桌面显示范围不同且不容易解释。

**建议简化/修正：** 服务端查询客户/会话号，统一分页和总数说明；手机队列也支持状态与历史查询。

**证据：** 发布源码确认；未查询真实历史消息。 [admin-support-panel.tsx:266](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:266>)、[admin-support-panel.tsx:303](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:303>)

**验收：** 101+合成会话可查旧记录，桌面/手机范围与状态一致。

<a id="s-03"></a>

### S-03 [P2] 切换会话读取失败时，旧详情仍留在回复区域

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** refreshDetail启动不清旧detail，失败只setNotice；回复按钮只检查会话open、pendingAction和草稿，未校验selectedId===detail.conversation.id或isLoadingDetail。

**操作影响：** 高亮B但详情仍是A时容易混淆发送对象；需要按失败条件进一步验证。

**建议简化/修正：** 切换时锁住发送，旧详情明确标记来自A，失败针对B给重试；发送同时验证选中ID与详情ID。

**证据：** 发布源码确认；B详情GET失败的条件交互尚未复现，列为风险候选。 [admin-support-panel.tsx:345](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:345>)、[admin-support-panel.tsx:556](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:556>)、[admin-support-panel.tsx:952](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-support-panel.tsx:952>)

**验收：** 模拟B读取失败，不能向A提交看似属于B的回复。

## 活动记录

<a id="m-01"></a>

### M-01 [P2] 活动时间线没有接入真实活动源

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** defaultAdminActivities为空，Dashboard不传initialActivities；组件没有读取后台活动API，添加/标重要仅改React state。

**操作影响：** 运营入口看似能查活动，但实际没有真实订单/库存/权限日志可查。

**建议简化/修正：** 连接真实审计事件的只读列表，按对象直达详情；本地便签明确作为独立个人工具。

**证据：** 线上页面待观察 + 发布源码确认；未代表数据库无日志。 [admin-activity-timeline.tsx:120](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:120>)、[admin-dashboard.tsx:487](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-dashboard.tsx:487>)

**验收：** 真实授权事件可查且日期/对象/权限范围清楚。

<a id="m-02"></a>

### M-02 [P3] 手机隐藏了本地备注的说明，刷新会丢便签

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 本地备注只存在state；说明localNoteDescription在hidden lg:block内，手机用户主要看到添加入口。

**操作影响：** 用户可能把备注当可长期保存的协作记录，刷新后才发现消失。

**建议简化/修正：** 要么保存到有权限的备注服务并给保存状态，要么在手机输入和提交旁明确本次页面临时便签。

**证据：** 发布源码确认；本次未把实际业务内容写进便签。 [admin-activity-timeline.tsx:180](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:180>)、[admin-activity-timeline.tsx:282](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-activity-timeline.tsx:282>)

**验收：** 刷新/离开前用户知道是否持久化，永久备注能回读。

## 设置权限

<a id="t-01"></a>

### T-01 [P2] 权限矩阵点一次就立即生效，缺少变更差异核对

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 角色选择和每个继承/允许/拒绝按钮直接PATCH；原因是自动生成的英文句子，没有新增/撤销权限预览或管理员输入原因。

**操作影响：** 误点可能立即改变员工操作能力；调整多个权限也须多次请求且难核对完整结果。

**建议简化/修正：** 先形成待应用变更，显示对象、原值→新值、有效权限差集与敏感权限；一次确认带业务原因，写后回读。

**证据：** 发布源码确认；本次未点击真实权限写入。 [admin-permissions-panel.tsx:268](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:268>)、[admin-permissions-panel.tsx:305](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:305>)

**验收：** 权限变更有完整预览、审计原因和回读，批量部分失败清楚。

<a id="t-02"></a>

### T-02 [P3] 后台设置外层中文，内部权限页却随语言切换

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** AdminSettingsPanel标题/说明写死后台设置和管理员工角色，内嵌权限页使用词典。

**操作影响：** 意大利界面出现中意混排，标题与内部用语不统一。

**建议简化/修正：** 外层标题/说明纳入词典；与账号工作台统一员工、角色、权限术语。

**证据：** 360意大利语组件截图明确复现。 [admin-settings-panel.tsx:13](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-settings-panel.tsx:13>)

**验收：** 意大利語设置页无中文标题残留。

<a id="t-03"></a>

### T-03 [P3] 手机员工列表用大块最小高度，少量员工时空白很大

**设备适用：** 手机稀疏员工列表，360意文；桌面列表最小高度另行权衡。

**现象：** 员工区max-height计算同时min-height240，卡片保持长列表区域；1个合成员工下屏幕主要是空白，角色和权限还需再切页签。

**操作影响：** 查看少量员工时信息密度低，用户需多次切换才能核对对象与权限。

**建议简化/修正：** 列表高度随数量缩短，选中员工摘要始终可见；常用有效权限与角色说明在同一详情内组织。

**证据：** 360意大利语合成截图 + 源码确认。 [admin-permissions-panel.tsx:428](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-permissions-panel.tsx:428>)

**验收：** 1/10/100员工状态下无过度留白且选中对象清楚。

## REMAX

<a id="x-01"></a>

### X-01 [P3] REMAX后台从总览快捷链接进入，缺统一模块导航和语言

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** 独立/admin/remax采用单独main和意大利文标题/说明，普通后台侧栏没有REMAX入口。

**操作影响：** 使用中文后台的人进入另一套页面后缺一致导航；日常到货要记住入口位置。

**建议简化/修正：** 在采购/商品区域提供固定REMAX入口，复用后台导航和双语；保留预订与真实到货确认的业务区别。

**证据：** 发布页面和组件源码确认；本次未浏览已登录REMAX真实业务数据。 [admin-remax-center.tsx:251](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:251>)、[page.tsx:39](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/app/admin/remax/page.tsx:39>)

**验收：** 入口可发现、语言跟随后台，能返回原模块。

<a id="x-02"></a>

### X-02 [P2] REMAX待处理预订单只列前8条，没有查看全部入口

**设备适用：** 桌面和移动端共用同一控件或业务请求，操作逻辑影响两端；布局结论按本项明确列出的视口证据判断。

**现象：** SummaryCard用dashboard.orders.slice(0,8)显示客户预订单，没有分页/查看全部/点击订单详情；右侧待收货也主要依赖批次下拉。

**操作影响：** 看到待处理数量后无法在该页逐单追查第9单，需要回订单模块重新找。

**建议简化/修正：** 摘要保留8单，提供全部REMAX预订单并预填商品/批次条件，订单号直达详情。

**证据：** 发布源码确认；未读取真实预订单。 [admin-remax-center.tsx:384](</Users/kyox215/Documents/partspro v4/.codex-worktrees/admin-products-ux-20261010/src/components/partspro/admin-remax-center.tsx:384>)

**验收：** 9+预订单可完整查询，点击能进入原单并返回批次。

## 可直接简化的日常流程

以下步骤数是建议的交互拆分，用于设计目标；没有做人员计时实验。减少导航、重复填写和逐行点击，保留金额、库存、发布和权限的校验/确认。

| 任务 | 当前多余步骤 | 建议流程 | 对应问题 |
|---|---|---|---|
| 客户来问一张旧订单 | 账号找最近订单→另去订单→逐页定位→打开详情 | 客户全部订单→点订单号→回原客户 | A-05/O-04/G-07 |
| 查订单号/SKU/客户 | 尝试顶栏无效搜索→找模块→翻页 | 顶栏搜索→结果直达 | G-01/O-04 |
| 处理5单打印/拣货 | 每单开详情→打印→关闭再找下一单 | 多选打印预览；详情处理下一单 | O-05 |
| 订单保存失败 | 弹窗先消失→看错误→重开→重填 | 原表单字段提示→直接修正重试 | O-01/O-02 |
| 给旧到货批次登记付款 | 退出对话框→调报表期间/类别→重开→找批次 | 对话框内按供应商/批次独立查询→看欠款→登记 | F-03 |
| 修正一个电话 | 填整份客户税务/双地址→填写原因→保存 | 字段修正+原因；档案完整性另做任务 | A-02 |
| 调整多个分类顺序 | 每项开编辑→改数字→保存→下一项 | 在列表排序→统一预览→保存 | P-06 |
| 10个SKU补货 | 逐件入队→逐件填写供应商/量→逐件保存 | 多选采购草案→按供应商填→逐项结果 | I-03 |
| eBay配置与刊登 | 手抄多个ID→另存→计划→发布→重复执行队列 | 就绪向导→读取政策→范围/价格预览→受控执行进度 | E-01/E-02/E-05 |
| 调整员工多个权限 | 每项三选一立即写→反复读结果 | 暂存变化→差异/敏感项核对→一次确认→回读 | T-01/A-04 |
| 查看库存/售后预警 | 看KPI→去模块→重新筛选定位 | 点预警直达对应清单/详情 | H-03/R-07 |
| 查活动原因 | 点营销→空时间线→去商品审计→看不全 | 真实活动记录→对象详情→完整变化 | G-03/M-01/P-05 |

## 明确错位、遮挡和布局问题

| 项目 | 本次结论 | 证据/范围 |
|---|---|---|
| 手机财务多行页签覆盖总览卡 | **实际复现，优先修正** | 360意大利语当前组件；F-08 |
| 短屏侧栏底部账号覆盖菜单 | **实际复现，优先修正** | 线上1280×568和合成组件；G-02 |
| 手机订单阶段/待办后半段隐藏 | **可滚动，但可发现性弱** | 360意大利文；O-07 |
| 手机售后结算/库存关闭隐藏 | **可滚动，但可发现性弱** | 线上390与合成组件；R-07 |
| 商品详情6页签 | **源码明确宽于手机且隐藏滚动条** | P-02；首屏是否露出需要随内容/滚动检查 |
| eBay手机编辑映射宽表 | **容器宽表，字段和操作分散** | 390合成有映射行；E-04 |
| eBay手机首屏全是统计卡 | **实际复现的布局效率问题** | 390组件；E-03 |
| 售后空队列大块空详情 | **实际复现的留白问题** | 线上390/合成空状态；R-08 |
| 设置手机少量员工留白 | **合成数据实际复现** | 360意大利语1员工；T-03 |
| 批次平板1180px表/列宽117% | **源码候选，待真实长内容复验** | 未当作已确认错位；P-07 |
| 商品列表手机/平板整页横向错位 | **本次样本未发现** | 390线上与360/768合成；不代表任意数据/键盘都已覆盖 |
| 图表DOM有离屏元素 | **未作为错位** | Recharts隐藏的辅助元素不等于用户可见布局问题 |

### 已查看的合成截图

截图用于说明布局，包含明确演示数据，不是生产交易证明。

- [短屏侧栏遮挡](../../outputs/admin-audit/2026-10-10/sidebar-short-1280.png)
- [360意大利文财务页签错位](../../outputs/admin-audit/2026-10-10/finance-360-it-IT.png)
- [360意大利文订单阶段](../../outputs/admin-audit/2026-10-10/orders-360-it-IT.png)
- [390售后空队列/阶段](../../outputs/admin-audit/2026-10-10/rma-390-zh-CN.png)
- [390 eBay首屏](../../outputs/admin-audit/2026-10-10/marketplace-390-zh-CN.png)
- [360意大利文设置混合语言/留白](../../outputs/admin-audit/2026-10-10/settings-360-it-IT.png)
- [768意大利文商品列表](../../outputs/admin-audit/2026-10-10/catalog-768-it-IT.png)
- [390逗号金额输入](../../outputs/admin-audit/2026-10-10/expense-comma-390.png)
- [客服B中保留A草稿](../../outputs/admin-audit/2026-10-10/support-draft-b-1280.png)

## 已排除的旧问题与应保留设计

主目录旧售后候选经过发布版本复核，以下4项已从现存问题数量中删除：切换/刷新重建旧大表单草稿、收货后旧备注表单没有保存按钮、没有换货/协商下一动作、十项业务动作同时铺开的旧布局。正式版本已有阶段、推荐动作、可读阻断、协商、替换件创建/绑定/发出、退供应商等路径。

商品手机卡片已经有本页选择，目录页已有草稿提示和自动滚动，商品图片失败已有重试、目录/商品版本冲突有防护，弹层已有可视区域保护；没有把这些再列为缺失。订单列表明确提示统计基于当前页，所以报告没有将其直接当成错误的全局KPI。退款批准、库存入账、到货物理确认、兼容人工复核和敏感权限校验应保留，简化针对导航和重复输入。

## 原审查阶段的建议实施次序与验收边界

1. **先防误操作：** F-01、S-01、E-01、G-02，F-08，以及保存成功/读取失败的状态分离。用模拟服务或隔离测试数据验证，保持生产写入批准边界。
2. **再缩短查找路径：** G-01、O-04、A-05、H-03、G-07；把列表查询、详情与返回串起来。
3. **补列表范围与纠错：** 财务50条、售后80条、库存50/8条、客服50/100条、REMAX8条；明确总数、加载范围、导出范围与原位更正。
4. **统一表单、权限与语言：** 原位错误、脏输入保护、字段关联、职责预览、中意词典。用有/无写权限的合成角色验证。
5. **优化视觉：** 手机隐藏阶段/页签、eBay首屏、空状态、平板批次表；随后整理菜单业务归属与持久偏好。

2026-10-10原审查阶段仅生成报告和审查证据，当时未修改应用代码/数据库、提交、部署或发布；因此该阶段没有重复运行全量lint/build。后续修复与正式发布结果以开头链接的最终报告为准。已执行源码复核、合成浏览器检查和金额/日期定向复现，最后对报告文件做diff空白检查。以后修复涉及API、权限或schema时应按AGENTS对应风险地图与独立生产批准执行，不能用本报告代替真实保存验收。

## 本次证据文件

- [浏览器布局结果](../../outputs/admin-audit/2026-10-10/browser-results.json)：记录实际请求面板、视口、标题、容器离屏测量与截图。离屏计数只是原始诊断，需结合截图与滚动容器判断。
- [关键交互结果](../../outputs/admin-audit/2026-10-10/interaction-results.json)：目录子区、金额请求、eBay请求、侧栏几何；首次客服定位失败保留，不伪称通过。
- [客服补验结果](../../outputs/admin-audit/2026-10-10/support-interaction-results.json)：修正控件定位后A/B草稿复现完成。
- [财务页签几何复现](../../outputs/admin-audit/2026-10-10/finance-tab-results.json)：记录360px意大利语页签边界与容器重叠。
- [金额/日期表达式复现](../../outputs/admin-audit/2026-10-10/input-reproductions.json)：有限数、JSON及Europe/Rome时区结果。
- [发布基准与发现索引](../../outputs/admin-audit/2026-10-10/audit-index.json)：源码版本、分级与全部问题ID。

报告记录可确定的缺陷、效率问题与待复验候选；数据样本数量、极端内容、员工实际权限、并发、打印设备和手机软键盘仍可能揭示其他问题。


## 2026-10-11 子流程补充审查（新增16项）

重新核对正式版本与隔离源码后，进一步检查通知中心、商品补货订阅、价格活动及运输费用弹窗。下面16项是初次64项中未独立覆盖的子流程缺陷，不能用原有面板布局通过来替代这些交互验收。另发现一个运输费用测试仍断言旧布局，已更新为当前三段流程并保留五个功能入口断言；未把测试陈旧误写为产品故障。

### N-01 P2｜通知读取失败没有明确错误，与“没有通知”混淆

- **现象**：通知列表HTTP失败直接返回，没有局部错误；首次失败可表现为空列表，已有数据也无法知道刷新失败。
- **影响**：用户可能认为没有新消息，缺少重试入口。
- **设备适用**：桌面、手机均有此逻辑问题；手机弹出层空间有限，更需保留明确错误与操作。
- **修复**：失败保留原通知，显示红色错误及重新读取入口；异常JSON/无效行/无效计数不再降级为空列表。加载与空结果分别显示。
- **验收/证据**：真实源函数503复现；定向测试验证失败标记、原数据不被覆盖及加载结束。组件模拟失败与窄屏检查追加在修复报告。

### N-02 P2｜打开已读或标记失败的通知也会减少未读数

- **现象**：原处理函数不检查POST成功，已读通知再次点击也会本地减1；服务器拒绝时仍修改本地已读时间。
- **影响**：未读徽标和服务器事实不一致，可能遗漏待处理事项。
- **设备适用**：桌面、手机；与布局无关。
- **修复**：已读条目直接导航，不重复POST；未读条目仅在有效成功回执后更新；计数重新读取服务器值，不猜测减1。
- **验收/证据**：合成3未读基线下，原函数打开已读降为2已复现；修复测试覆盖已读零POST、拒绝后保持未读、双击动作锁。

### N-03 P2｜通知只展示最新20条，没有更早记录入口

- **现象**：总未读数可能大于20，面板只能读取最新20条。
- **影响**：旧未读通知不可达，计数与可处理列表范围不匹配。
- **设备适用**：桌面、手机；均采用局部滚动与“加载更早通知”。
- **修复**：添加创建时间＋UUID双键游标、hasMore及加载更多；保留PostgreSQL微秒精度，对重复ID合并，继续限定当前收件人。
- **验收/证据**：测试精确总未读121、limit+1及相同时间UUID排序；严格时间/UUID校验拒绝原始过滤器注入。不会把JavaScript毫秒截断用于数据库游标。

### N-04 P2｜损坏JSON与空ID数组可能意外变为“全部已读”

- **现象**：原POST把损坏JSON当作空对象，服务层空ids数组也落入无ID过滤的全部已读逻辑。
- **影响**：调用方本想标记一条或请求无效，可能改变所有未读记录。
- **设备适用**：桌面、手机；API与服务契约问题。
- **修复**：损坏JSON立即400，显式ids必须1～50个UUID；服务层ids=[]只做无副作用返回。显式合法空对象仍表示用户点击“全部已读”。
- **验收/证据**：实际Route Handler加合成Auth/service测试，错误载荷均零服务写调用；匿名401；正确{}保留原功能。未在生产制造错误写入。

### N-05 P2｜通知测试的失败和设备投递结果没有区分

- **现象**：测试发送未检查完整回执；浏览器允许权限被文案表达成已开启，站内记录与设备投递缺少区分。
- **影响**：用户可能把未投递/被拒绝当作成功，重复发送测试。
- **设备适用**：桌面、手机；iPhone主屏幕安装说明保留，物理设备投递未验收。
- **修复**：成功须有有效事件数与推送计数；站内创建但设备投递未确认显示警告；网络/5xx/损坏回执锁定提交，提供刷新核对；写成功但读失败不提示重发。权限文案只描述浏览器许可事实。
- **验收/证据**：测试4xx、5xx、网络断开、2xx坏JSON、站内成功但无设备投递、并发一次发送。未实际给客户发测试通知。

### N-06 P2｜通知导航可绕过后台草稿与提交保护

- **现象**：点击通知或Service Worker通知打开事件直接router.push，与主导航保护不一致。
- **影响**：付款/活动/库存等未保存内容可能被带离；提交进行中可能切换上下文。
- **设备适用**：桌面、手机，包括站内通知与推送打开事件。
- **修复**：导航复用后台dirty/mutating标记：处理中拦截，未保存询问；目标必须属于本站，拒绝协议相对地址及反斜线。
- **验收/证据**：真实导航守卫测试覆盖处理中、用户取消放弃、无草稿通过；源组件与服务工作器监听采用同一保护。

### C-01 P2｜全局价格活动草稿随折叠或切换客户消失

- **现象**：关闭details会卸载内容，父层key绑定客户导致切客户时重建全局活动状态。
- **影响**：已输入有效期和变更原因丢失，需重复录入；全局配置与客户报价混淆。
- **设备适用**：桌面、手机；手机更常折叠长区块。
- **修复**：首次访问后稳定挂载，折叠仅隐藏；只给客户报价区绑定客户key。活动明确标为全局配置，草稿保护保留。
- **验收/证据**：修复前8个月折叠恢复为3、切客户7恢复为3已实际复现；修复后8个月与原因经折叠、A→B仍完整。

### C-02 P2｜活动提交中仍可修改字段，回包覆盖新输入

- **现象**：6个月提交后还能修改9个月与原因，响应再把字段恢复6个月并清原因。
- **影响**：用户无法分辨究竟保存哪份内容，输入被覆盖。
- **设备适用**：桌面、手机；触屏重复点击风险相同。
- **修复**：fieldset、活动保存、客户切换和账号延迟定位在提交中锁定；同步ref阻止同一帧重复提交，保留原请求内容。
- **验收/证据**：真实组件挂起测试确认全部字段、客户选项禁用，只有1个待处理请求；源状态测试覆盖晚到客户报价回包丢弃。

### C-03 P2｜活动提交成功但坏回执可能重复保存

- **现象**：模拟服务器已写入，2xxJSON损坏却只显示原始解析错误，保存仍可再次点击。
- **影响**：产生重复配置审计记录，用户不能核对是否已保存。
- **设备适用**：桌面、手机；手机警告区与核对按钮允许换行。
- **修复**：网络、5xx和损坏2xx判为未知；8秒请求上限；保留原body/reason并锁编辑与保存，重读只GET，显示当前配置，明确核对后采用当前配置恢复编辑。第二次重读失败使旧核对快照失效。
- **验收/证据**：实际模拟提交计数2保持2，重读仅增加读请求；360px无整页溢出，警告有图标/标题/文字。未修改生产活动。

### C-04 P3｜价格详情/分类预览与电商外框仍混用中文

- **现象**：账号主体切为意大利文后，价格解释、等级活动、分类价格预览、电商标题与页签仍中文。
- **影响**：意大利员工理解成本高，按钮状态与错误不清楚。
- **设备适用**：桌面、手机；标签长度增加需要换行。
- **修复**：跟随现有locale提供中/意完整文案，报价错误/空态/加载与活动核对使用共享状态组件，标题/页签保持语义。
- **验收/证据**：意大利文真实组件检查与源状态测试；未把浏览器原生中文日期选择器或合成场景控制器算成产品中文残留。

### B-01 P2｜补货订阅固定100条，剩余提醒没有入口

- **现象**：弹窗offset=0、limit=100，丢弃接口meta.total。
- **影响**：超过100条时运营人员看不到后续订阅，处理进度不完整。
- **设备适用**：桌面、手机；移动弹窗正文独立滚动，页码按钮可达。
- **修复**：每页50条，展示精确待处理数/页码、上一页/下一页；服务按created_at/id稳定排序，处理最后一页后自动调整到存在的页。
- **验收/证据**：接口源测试121条总量、offset100与50页容量；组件模拟3页范围。分页属于实时列表，不宣称事务快照。

### B-02 P2｜补货订阅读取错误在弹窗后方，弹窗却显示空

- **现象**：读失败清空数组，错误交给弹窗后方父面板，当前弹窗只看到“暂无”。
- **影响**：用户以为已处理完所有提醒，且无法直接重试。
- **设备适用**：桌面、手机；移动遮罩使父层错误更难发现。
- **修复**：弹窗内保留旧行，红色错误与重新读取；无效DTO/元数据/上游schema warning都视为读取异常，失败时禁止按陈旧行处理。
- **验收/证据**：严格解析测试及模拟错误弹窗；真实生产业务列表只读，未人为断开生产数据源。

### B-03 P2｜补货状态回执未核对就删行并减计数

- **现象**：更新helper可能返回null，调用方不检查，仍移除原行、减计数、提示成功；提交中弹窗可关闭。
- **影响**：坏响应或网络不确定时页面伪造成功，重复处理可能发生。
- **设备适用**：桌面、手机；弹窗关闭/导航与忙碌态一致。
- **修复**：回执必须匹配原ID、SKU和期望状态；未知结果保留目标并锁重复动作；通过新增同权限只读GET逐条核对当前事实，确认非active才更新计数，已处理ID只回调一次。提交中拦截关闭。
- **验收/证据**：测试空、错ID、错SKU、错状态、5xx、网络、409以及只读恢复；不通过“active列表找不到”猜测已通知。

### B-04 P2｜两人同时处理可覆盖已完成提醒的终态

- **现象**：原更新只按ID过滤，晚到的取消可覆盖另一人已通知结果。
- **影响**：处理记录不稳定，恢复核对后再提交仍可能改写已处理事实。
- **设备适用**：桌面、手机；并发业务逻辑。
- **修复**：原子UPDATE同时限定id与status=active；零匹配返回409，引导只读核对，保留现有product.read_admin授权要求。操作文案说明“已通知”只登记人工已联系事实，不自动发消息。
- **验收/证据**：实际repository函数执行测试确认双过滤与409，无新增SQL/RLS/权限扩张；独立专项复核后发布。真实多人并发业务写未执行。

补充证据：[通知原问题复现](../../outputs/admin-repair/2026-10-11/notification-gap-reproductions.json)、[子流程浏览器验收](../../outputs/admin-repair/2026-10-11/supplement/browser-verification.json)。新增的组件错误、未知、处理中、空态与主要/次要动作沿用前一轮规范，不另立视觉系统。运输费用创建弹窗桌面1437×827及360×740均正文可滚动、底部操作可达；逗号输入1,23保留，遗漏VAT/资本化金额给字段校验，未提交实际费用。


### N-07 P2｜通知弹层在短屏显示警告后，底部操作超出可视区

- **现象**：360×740真实组件模拟未知结果时，弹层top387/bottom902，底部“全部已读/测试”按钮bottom894；容器没有采用Radix提供的可用高度。
- **影响**：短手机/横屏及靠下的通知触发点会让动作不可达，滚动页面不能替代弹层自身约束。
- **设备适用**：手机和短屏桌面；普通大桌面可正常显示，不能据此忽略边界。
- **修复**：弹层最大高度取600px与Radix可用高度的小值，列布局；列表min-height:0可缩小并内部滚动，页码/底部动作保持可达；异常信息可在局部滚动查看。
- **验收/证据**：修复前真实浏览器边界和截图确认，修复后360×740及1280×568检查底部按钮与viewport范围。详情见补充浏览器验证，不把fixture外部测试控件当成产品界面。


### B-05 P3｜补货提醒弹窗的桌面宽度仍被默认小弹窗覆盖

- **现象**：1437px桌面真实组件的弹窗实际宽384px；调用方max-w-3xl被基础组件sm:max-w-sm覆盖，长SKU与客户编号被挤到狭窄左列，底部按钮换行。
- **影响**：大屏未发挥空间，阅读与处理效率低；不是内容横向滚动的正常宽表行为。
- **设备适用**：桌面；手机原有左右16px安全边距合理。
- **修复**：显式sm:max-w-3xl覆盖同一断点默认值；手机继续由基础容器限制宽度，保留局部滚动与页码动作。
- **验收/证据**：修复前桌面384px截图/计算样式已确认；修复后桌面宽768px、手机328px及短屏底部可达实际核对，见补充浏览器证据。
