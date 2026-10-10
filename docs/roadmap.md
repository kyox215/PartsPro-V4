# PartsPro Roadmap

Period: 2026 H2
Owner: 总调度/项目经理
Last reviewed: 2026-09-28

## 2026-09-28 账号价格制度闭环（已发布）

- Task ID：TASK-20260927-01；P1 / R3；主责价格与客户部。客户、SKU、数量统一进入权威报价，报价失败关闭购买与结算入口；人工/自动等级、促销取高与到期恢复、注册权益、免折扣及后台解释形成闭环。
- 数据库 migration `20260927141646_account_pricing_authority.sql` 经 linked dry-run、独立 Migration/RLS 审查及老板明确批准后应用到 `PartsPro-V4` / `yiuxrjqexlfjtxxrkqvi`。远端 migration、RPC、私有配置/领取账本和执行权限核对通过。
- 应用部署 `dpl_9gWPU9yQ6UXtQcj1dmdphjFUqHJk` 已 promote 到 `partspro.app` / `www.partspro.app`。首页、目录、公开目录 API 和后台鉴权门禁 smoke test 通过；正式站受控零售账号显示 CB25 橙色 `1,90 €` 且明确“零售价 · 不参与等级折扣”。
- 完整证据、验证范围、回退与未复现的具体账号限制见 `docs/tasks/done/P1-2026-09-27-account-pricing-closure.md`。本次未改商品原价、真实客户等级、历史订单或库存。

## 2026-09-26 加载性能修复

- 发布候选基于线上 Git `3d55b4a`，保留现有 RMA、运输及 REMAX 功能。将此前仅存在于 CLI 发布中的性能改动纳入 Git，避免随后自动发布覆盖。
- 首页按区块流式加载；公共商品短缓存；图片按显示尺寸优化；目录请求取消过期结果并缓存近期公共页面；账户、后台订单、概览及商品面板按需加载。
- 本轮进一步移除客户端整套双语字典，取消首屏外商品图高优先级加载，压缩 Logo，限制客服布局监听并消除重复 ResizeObserver 订阅。
- 候选已通过全量 lint、生产构建、49 项性能/订单/概览/RMA 测试及 6 项 storefront 测试；浏览器通过真实商品跳转、返回、筛选竞态、缓存恢复、移动菜单、匿名访问限制、客服避让和中意语言切换。
- 本次不包含 migration、生产 env 或客户批量结算功能；线上发布后的性能与错误核查仍须以实际部署结果为准。

## Now

### 2026-09-26 第三轮性能优化（已发布）

- 基于已上线 `73265ed` 隔离实施：匿名商品详情省去用户鉴权和买家价格查询，保留 SKU、旧 slug、图库及完整详情备用读取；已登录价格逻辑保持原有契约。
- 账户菜单按 hover/focus/click 下载；手机菜单仅在移动断点挂载。保留第一次点击、键盘焦点、加载取消和失败重试。
- 公共导航与横幅使用项目隔离的 Next Data Cache（60 秒 / 30 秒），只读取无会话的匿名客户端。写入成功后失效；失败结果不缓存；横幅每次渲染检查有效时间，超过 30 秒的旧响应重新读取。
- 发布前已通过完整 lint、生产构建、47 项相关测试和 8 项真实 Chrome 菜单交互。两个独立本地生产进程验证公共导航/横幅缓存复用；桌面首屏未下载两个菜单的独立 chunk。
- [PR #3](https://github.com/kyox215/PartsPro-V4/pull/3) 已合并为 `7c579e0`，性能验收部署 `dpl_AZ5kcJbVgaviM7Q5uptFWiJVhgKM` 来自 Git main，正式域名核对通过。本轮不包含 migration、生产环境配置、依赖或结算功能。
- 同条件手机 4G（9 Mbps、80 ms）、4 倍 CPU 降速、每页 10 次新浏览器上下文：内容就绪样本 P90 首页 `1638 → 1504ms`、目录 `1215 → 1413ms`、详情 `1553 → 1289ms`；目录中位数 `1166.5 → 1107.5ms`，慢端存在波动，不能声明所有分位均改善。30 次全部 HTTP 200、无浏览器错误/破图/横向溢出。
- 部署后单独首轮：首页内容就绪 `2256ms`、完整 load `1987ms`、LCP `2224ms`；目录内容就绪 `1726ms`、详情 `1318ms`。首次首页仍未满足 2 秒目标，浏览器冷缓存不代表冷服务端/CDN，样本 P90 不是全站真实用户 P95。
- 正式站 8 项菜单首击/键盘/取消/故障重试/断点切换全部通过；商品跳转 `998ms`、筛选 `385ms`，WebP 与匿名账户/后台/RMA/结账门禁通过，观察窗口 error/5xx 日志均无返回记录。未验收登录客户与后台真实交易 UI。
- 验证脚本用实际线上 chunk 名，并按 URL pathname 匹配以兼容 Vercel 的部署查询参数。可复用脚本为 `scripts/performance-cold-samples.mjs`、`scripts/verify-deferred-menus.mjs`；详细运行证据保留在项目本地 `outputs/performance/2026-09-26/round3/`。
- 回退基线：Git `73265ed` / Vercel `dpl_4JNzQjSZuLHN1UPuGQALuHCh43LG`。若出现关键浏览路径失败，恢复该应用版本；本轮无数据库补偿需求。

| Outcome | Why now | Owner | Evidence / exit criteria | Risk |
|---|---|---|---|---|
| AI Company OS 全量接入 | 让老板一句话派单能进入可追踪流程 | 总调度/项目经理 | `.ai-company/`、章程、风险、决策、runbook、任务模板就绪 | 低 |
| Storefront 交易链路稳定 | 商品、价格、购物车和订单是收入主链路 | 订单运营部 | lint/build、API smoke、业务契约检查 | 高 |
| Supabase migration 安全门稳定 | linked 项目按生产敏感处理 | 平台发布部 | migration list、dry-run、风险扫描和应用后查询证据 | 高 |
| 客户等级与价格规则收敛 | B2B 价格错误直接影响利润与信任 | 价格与客户部 | 前后端字段、RPC/API DTO、UI 文案一致 | 高 |

## Next

| Candidate outcome | Dependency | Validation needed | Priority rationale |
|---|---|---|---|
| 项目 runbook 补全 | 治理接入完成 | 发布清单、事故响应、供应商导入 SOP 通过一次真实任务 | 降低重复操作风险 |
| 后台商品与库存管理增强 | 业务契约和 schema 状态清楚 | admin UI smoke、库存动作审计、权限检查 | 提升店铺运营效率 |
| 供应商到货导入闭环 | 到货声明规则和数据库写入路径稳定 | preflight、声明确认、写库后数量/金额/库存/审计核对 | 降低人工录入成本 |
| eBay 渠道试点 | 商品资料、库存和价格规则稳定 | sandbox 或受控真实刊登、队列失败恢复 | 扩大销售渠道 |

## Later

| Direction | Opportunity | Uncertainty |
|---|---|---|
| 自动补图和商品资料质量评分 | 提升目录质量，减少人工整理 | 图片版权、供应商数据质量、匹配准确度 |
| 客户信用、钱包退款和售后自动化 | 提升 B2B 客户体验 | 资金、税务、审计和权限复杂度 |
| 更完整的 BI 与经营分析 | 帮老板看库存、利润、热销和缺货 | 数据质量和指标口径 |
| 多语言客服和营销自动化 | 支持意大利语、中文、英语客户沟通 | 文案准确性、合规和人工审核 |

## Not Planned / Stopped

| Item | Reason | Revisit trigger |
|---|---|---|
| 代理自动执行生产破坏性 SQL | 数据风险不可接受 | 用户明确批准且有备份、dry-run、回滚和独立验证 |
| 把 Vercel 发布与 Supabase migration 绑定为一个自动动作 | 发布和数据变更风险不同 | 有成熟 CI、预发环境和回滚演练后再评估 |
| 用通用 AI Company OS 覆盖 PartsPro `AGENTS.md` | 会破坏现有业务和数据库护栏 | 只有在全部 PartsPro 专用规则迁移完并经批准后才可讨论 |

## Capacity And Portfolio Balance

- 60% 核心交易、数据正确性和生产风险控制。
- 25% 运营效率、供应商导入和后台工具。
- 10% 文档、runbook、质量门禁和复盘。
- 5% 探索性自动化和渠道试点。

## 2026-09-26 售后钱包闭环修复（生产数据库已应用，前端待发布）

- Task ID：TASK-20260926-RMA；P1 / R3；主责订单运营部，协作仓库库存部、价格与客户部。主助手实施前后端，数据库专项负责新增 migration，业务契约与 migration/RLS 守门独立验收。
- 用户批准本地实施：钱包退款优先；检测争议先协商；按实收拆分处理；退商品折扣后实付额及对应税额，运费另审。已于后续明确回复“批准”授权本次 db push，并明确要求部署上线。
- 基线：已核实生产部署 dpl_RuZ7FWurm14GBUY7iz91Ze11YbDw 对应隔离发布提交 f26c793（包含最新客户结清功能）；修复在 codex/rma-wallet-closure-20260926 独立 worktree。
- 范围：RMA 客户/后台/API/数据库动作、钱包退款审批与订单金额上限、库存处置；禁止修改旧 migration、静默变更历史售后结果或覆盖主目录改动。
- 验收：检测失败不能回可售；少收/混合处置能分拆；协商结果可追踪；专属换货凭证；退款税额与累计实付 cap 正确；重复/并发不重复资金库存；客户公开 DTO 不泄漏内部数据。
- 验证计划：相关 RMA/钱包合同及本地数据库事务测试、storefront 测试、全量 lint/build、目标 UI 交互；linked 只读核对和 dry-run。生产 db push 须另行展示清单并批准，发布独立处理。

- 已实现：仅检测通过允许回可售；收货前/质检前数量拆分、未收取消；协商退款/换货/寄回/同意报废；专属零价换货真实锁库、取消后受控解除重建；原商品实付及原税额上限、稳定税基与尾差、退款拒绝重试；客户到账金额/状态/物流/关联申请与通知。运费不自动混入商品退款，仍须另审。
- 独立门禁：审查曾发现部分协商退款会抬高后件税额，已以 `refund_allocated_tax_amount` 冻结原税基修复；主助手核对最终差异。原待审批历史申请按原额度兼容，不自动补税；其他缺快照的旧单需人工核验原始订单金额。
- 数据库验证：PostgreSQL 17 实际载入 113 个 migrations，49 个 SQL 断言点及正/倒序审批、拒绝重试、双连接并发测试通过；auth/storage/cron 基础设施使用 stub，跳过 4 个仅生产商品数据补丁。隔离测试容器和卷已清理。命令：`RMA_V4_FIXTURE=tests/rma-v4-database-integration.sql node scripts/rma-v4-db-test.mjs <独立测试容器>`。
- 界面验证：优化构建下 1440×1000 / 390×844 真实组件交互通过，API 全部夹具模拟；覆盖拆单、协商确认、寄回、创建/解除换货、客户拒绝与到账展示。截图及结果位于 `outputs/rma-v4/`。可用 `node scripts/verify-rma-v4-ui.mjs --prepare` 生成临时夹具，验证后必须 `--cleanup`；本次临时页面已移除，测试服务已停止。此证据不是生产端到端测试。
- 生产门禁：本 worktree 复用已核验的无密码连接元数据，`migration list --linked` 无 remote-only divergence；最终 `db push --linked --dry-run` 仅列 `20260926110808_rma_v4_wallet_negotiation_split_closure.sql`。目标 PartsPro-V4 / yiuxrjqexlfjtxxrkqvi。后续用户批准后已完成本次真实 push；前端已在最新 `main` 基线上部署。
- 迁移风险/补偿：新增字段/索引/受限 RPC，替换旧 v3 关键守卫与钱包税额同步逻辑，无删除表/数据、批量历史回填或 RLS policy 重写。应用需短时 DDL 锁；不应通过删除新列回滚已有业务结果。异常时停用新增售后动作并以补偿 migration 前向修复；钱包/库存已发生业务须逐笔审计补偿。数据库应用与前端发布分开批准，新前端要求 v4 capability。
- 最终应用代码验证：126 项售后/通知测试、6 项 storefront 测试、全量 `npm run lint`、移除临时夹具后的 `npm run build` 均通过；`git diff --check` 通过。当前修改保存在独立 worktree，未合并、推送或发布。

- 2026-09-26 生产应用记录：用户针对本次清单明确回复“批准”。重新核验 project ref/name、无远端分歧且 dry-run 仅本条后执行 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked` 成功。迁移 SHA-256：`85743b5d5ec795053186c5359407154c77b6d7ab37696b1e450ba536c811c507`。
- 应用后核验：本地/远端 `20260926110808` 一致，再次 dry-run 为 `Remote database is up to date`；v4 capability 返回 ready=true / rma-workflow-v4；12 个新增 RMA 字段、定价触发器、未取消换货唯一索引、旧 v3 QC 守卫及冻结税基函数均存在。新 public RPC 禁止 anon，private helper 禁止 anon/authenticated，search_path 固定。安全 advisor 的 authenticated SECURITY DEFINER 提示按已审查的函数内身份/权限门控制；其他原有提示未在本次扩大修改。仅做结构和只读验证，未创建真实退款/订单或调整库存。
- 2026-09-26 发布记录：工作区先变基到 production 当前 `main` 的 `5e14141`，并剔除了已被该分支删除的旧结算功能提交。Vercel production deployment `dpl_7dGhHA5gHQQ7ghMK4uSszDgXDgyX` 状态 READY，别名为 `www.partspro.app` 与 `partspro.app`。上线后的 `/` 与 `/rma` 返回 200，未认证 `/api/rma` 正确返回 401；发布后 30 分钟生产 runtime 无 error/fatal 日志。

## 2026-09-28 手机弹层修复发布

- 发布分支 `codex/mobile-overlay-fix-20260928`，基于已上线账号价格版本 `861c26e`。Vercel 当前基线 `dpl_9gWPU9yQ6UXtQcj1dmdphjFUqHJk` 的 357 个源码/资源/配置 SHA1 与该基线全部一致；本次只提取弹层布局、滚动与校验提示，无新增 migration、API 或业务规则变化。
- 公共 Dialog/AlertDialog/Sheet 适配动态视口和短屏，客户、订单、财务、库存表单正文可滚动，按钮可达；保留线上新版菜单、供应商费用及售后功能。导入/运输费用底栏负边距溢出一并修复。
- 隔离发布源码验证：全量 lint/build、6 项 storefront 和 35 项账号价格/运输 UI 合同测试通过；真实组件＋模拟 API 的 91 项浏览器检查通过。旧运输 UI 测试的客服偏移调用断言更新为线上已有的购物车/checkout 限定行为，未改客服逻辑。独立发布专项审查通过。
- 证据 `outputs/overlay-ui/2026-09-28/browser-result.json`。构建使用与发布 lockfile 同版本的既有依赖（主目录额外 analytics 包未被本分支引用或部署）。真实 iPhone Safari 软键盘未实机验证。
- 用户已授权推送部署上线，实际发布结果如下。

- 2026-09-28 发布完成：修复提交 `c33a1ac` 已推送到 `origin/codex/mobile-overlay-fix-20260928`；Vercel 候选 `dpl_EE4NmwdYDoPeeN3vgVgFEcofRGYX` 远端 build READY，7 项受保护访问检查通过后 promote。`partspro.app` 与 `www.partspro.app` 的 alias API 均确认指向该部署。
- 上线后 11 项只读检查通过：手机菜单位于可视区域、关闭恢复背景滚动，首页/目录/购物车/账号/后台页面 HTTP 200、公开目录 API 200，未登录后台账号/价格 API 401，正式 CSS 包含视口保护；本次部署近 10 分钟 error 查询无记录。未验证登录管理员真实保存与真机软键盘，业务写入仍仅由模拟接口测试覆盖。
- 发布证据：`outputs/overlay-ui/2026-09-28/{deployment-verification,candidate-smoke,live-smoke}.json`。回退部署 `dpl_9gWPU9yQ6UXtQcj1dmdphjFUqHJk` 保留；本次没有 migration、生产数据或环境变量变更。源码已推送发布分支，未合并 GitHub main；已上线历史功能完整保留。


## 2026-10-04 两单作废与员工钱包退款

- 老板明确指定的两单屏幕各 EUR 13，共 EUR 26 已退至原客户钱包；两单 cancelled/作废隐藏，原订单支付与明细保留，库存没有增加。任务与实际核验见 `docs/tasks/done/P1-2026-10-04-order-void-wallet-refund.md`。
- 员工 RMA 钱包批准入口已上线，申请与批准权限分离，QC exact 权限与服务端读权限边界修复；保留已上线协商、分拆、收货向导及换货流程。未新增 migration、改 env 或员工授权。
- 发布源码为项目内 `.codex-worktrees/employee-rma-refund-20261004` / 分支 `codex/employee-rma-refund-20261004`，提交 `02f93eb`，基于当前线上 c33a1ac/c344fadc；主目录较早且有其他既有未提交改动，本次未整目录部署，尚未推送/合并 GitHub main。
- 34 项 RMA/员工合同测试、6 项 storefront、全量 lint、生产 build、桌面/手机/意大利文真实组件模拟 API 验证与独立审查通过。Vercel 候选远端 build READY，6 项候选及7项上线只读检查通过；两个正式域名指向 `dpl_GTEgBj9PQrU1gfNfLob6gD2caGwf`，短时错误日志聚合无记录。
- 回退代码部署 `dpl_EE4NmwdYDoPeeN3vgVgFEcofRGYX` 保留；代码回退不会撤销本次已批准的钱包退款。真实员工账号线上退款 E2E 与真机 Safari 未验证，模拟测试与实际两单 SQL核验分别留证。

## 2026-10-06 历史售后钱包退款

- 最新截图两条售后 PP-20260803110230-D3DDD9 / 3000000194072 与 PP-20260812152916-53B7E4 / 3667075265009 已分别入原客户钱包 EUR6.50、EUR14.50，余额EUR21；唯一credit各1，两条closed，原restock/scrap数量和收货/QC证据保留，无新增库存流水。与10月4日EUR26为不同订单。
- 按已上线源 `.codex-worktrees/employee-rma-refund-20261004` 完成固定钱包操作区和受控历史退款准备函数候选；36项合同测试、lint/build、隔离SQL集成与并发唯一入账、390×844模拟接口交互及独立Migration/RLS专项通过。
- 老板本次明确“批准”后，新migration `20261006002331_prepare_legacy_rma_wallet_refund.sql` 重新dry-run仅本条并受控应用；remote函数/ACL/原两笔ledger核验通过。源码763c01b部署到production候选并核361源码哈希及7项smoke，独立PROMOTE GO后正式发布，两域名指向 `dpl_FZHgXPWj6fLzuHNw23yDHxQGcgJb`，正式7项检查与短时无error/fatal日志通过。保留旧部署回退；没有改env/员工授权，没有重复退款。截图为演示接口，真实员工线上E2E未验证。详情 `docs/tasks/done/P1-2026-10-06-legacy-rma-wallet-refund.md`，证据 `outputs/rma/2026-10-06/`。


## 2026-10-10 — 商品管理 UX 发布候选

- 从当前生产源码763c01b的文档后续456567c建立隔离分支 `codex/admin-products-ux-20261010`，保护主目录未提交候选。
- 商品筛选请求竞争保护、旧结果操作锁定、分页回退与offset边界；手机勾选和本页全选、隐藏确认、批量部分结果与回读；编辑/媒体/库存关闭保护、提交锁、弹层错误和输入保留。
- “百货系列”显示为“电子产品 · 高端产品”，真实业务值不变；型号/供应商按API契约允许可选，旧分类保留。
- 详细建议：`docs/audits/2026-10-10-admin-products-ux.md`；本次无migration，也未引入完整目录候选schema。图片并发、跨请求库存幂等和目录完整管理仍单列。
- 本地lint/build与32相关行为/合同测试PASS；1440/360/390/768中意交互PASS；创建权限图片重试create=1/PATCH=0/image=2。证据 `outputs/admin-products/2026-10-10/`。待精确提交推送、候选部署、独立GO和生产域名smoke。

- 发布完成：源码 `e35da93`；正式部署 `dpl_3uXTPRgAjbBTxxhMJoufPhsTdwDm`，两正式域名均已核对。362上传源码hash与7候选/7生产GET检查PASS，独立发布GO。线上staff手机选择/确认取消/搜索/编辑取消和桌面布局通过；桌面未保存退出测试因浏览器自动化超时中断，不计生产PASS，临时输入待用户关闭。此次没有真实商品/库存/图片写入；完整目录metadata migration仍未应用。

## 2026-10-10 — 目录管理数据库应用与发布

- 用户明确“确认迁移数据库”，本次dry-run仅20261010081040，无remote-only历史分歧。已受控应用到PartsPro-V4/yiuxrjqexlfjtxxrkqvi；再次dry-run up to date；12函数摘要和RLS/ACL核对通过，17976商品/2399库存及商品状态聚合摘要前后相同。
- 目录管理页签、双语名称/排序/品牌分类启停、目录预填新建和原子批量移动已移植到当前已上线商品UI基线；版本保存、固定UUID草稿防重、公开目录修订刷新接入。全量lint/build、38合同测试、离线实际schema安全/并发与四视口目录和原UI回归通过。
- 詳细报告 `docs/audits/2026-10-10-catalog-directory-release.md`；证据 `outputs/catalog/2026-10-10/`。数据库已应用，页面发布正在核对精确源码与候选；正式域名切换结果待下条记录。无真实商品/库存/图片写验收，物理手机键盘未验证；图片并发和库存跨请求幂等仍独立待处理。
