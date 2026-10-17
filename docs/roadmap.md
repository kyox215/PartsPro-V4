# PartsPro Roadmap

Period: 2026 H2
Owner: 总调度/项目经理
Last reviewed: 2026-10-12

## 2026-10-12 后台紧凑组件重排（已发布）

- 老板针对库存统计、售后长名称、Excel 导入预检的竖向空间提出标注，先验收预览，随后明确授权“上线”。基于已发布应用的隔离分支 `codex/admin-component-density-20261012` 实施，保留原样式和原操作入口。
- 库存 8 项摘要 160px，体检 4 项 62–72px；售后名称最多两行、客户与负责人横排；导入标题与当前步骤 77px，7 项统计 122px。财务、概览、分析复用同一摘要；相关只读长名称可点击全文，新增折叠控制至少 44px 点击高度。
- 本地 9 个相关预览单元包含前后对照、全文示例与交互工作区。5 个标注流程、8 个相关名称场景、20 个局部案例及 9 次定向复验、72 个既有合同测试、定向 lint/build/diff-check 和独立 GO_LOCAL_PREVIEW 通过。细节见 `docs/previews/admin-component-density-20261012/README.md`。
- 应用 `4f30c3e` 已推送隔离分支并 promote 到 `dpl_F4MW4NgmxFWHndeVTzNk9MzRPuur`；两正式域名核对一致，候选及正式站各 11/11 匿名 GET、436 上传文件哈希、全量 lint、同提交 Git/生产构建和独立 GO_RELEASE 通过，短窗口错误记录 0。GitHub 无注册测试 CI，本轮不宣称其通过。无 API、DTO、migration、依赖或生产配置改动，真实业务写入和物理 Safari 未验收。回退为上一部署 `dpl_9GouAqee1NKPggTwoPJpcsS1pWf7` / `975f435`；发布回执见预览目录 `evidence/release-record.json`。

## 2026-10-11 后台原样式信息密度优化（已发布）

- TASK-20261011-ADMIN-UI / R2，老板已授权按照预览规划实施并推送上线。基于原生产 `44f8904` 的独立分支；主目录本地修改与被拒绝的手机重设计不混入本次候选。
- 保留原配色、卡片、侧栏、手机标题栏与弹窗；整理菜单、搜索、选项、低频筛选和已选条件，覆盖 12 组模块的 44 个验收单元。合成数据真实组件预览与生产业务写入证据分开记录。
- 应用 `975f435` 已推送隔离分支并 promote 到 `dpl_9GouAqee1NKPggTwoPJpcsS1pWf7`，两正式域名核实一致。44 单元/88 截图、264+6+20 项测试、lint/build、435 上传文件哈希与独立 GO_RELEASE 通过；发布后 11/11 匿名 HTTPS GET、短观察错误记录 0。无新 migration、数据库/API/DTO/依赖/env 写入，真实交易与物理 Safari 未验收。进度与门禁见 `docs/tasks/done/P1-2026-10-11-admin-ui-preserve-style.md`。

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
- 目录管理页签、双语名称/排序/品牌分类启停、目录预填新建和原子批量移动已移植到当前已上线商品UI基线；版本保存、固定UUID草稿防重、公开目录修订刷新接入。全量lint/build、39合同测试、离线实际schema安全/并发与四视口目录和原UI回归通过。
- 詳细报告 `docs/audits/2026-10-10-catalog-directory-release.md`；证据 `outputs/catalog/2026-10-10/`。数据库及依赖页面已上线，最终记录见下条。无真实商品/库存/图片写验收，物理手机键盘未验证；图片并发和库存跨请求幂等仍独立待处理。

- 最终发布完成：运行源码832c53c已推送codex/catalog-directory-release-20261010，最终生产部署dpl_BgiuoEqK7TPqFqSA66FC8KvG3qCL，两域名指向已核对。370上传文件hash/同SHA Vercel success/10候选和11线上GET检查通过，独立PROMOTE GO；短时error日志0条。IAB真实生产桌面1280及手机390目录名称、REMAX导航、无横向溢出、菜单关闭复查通过。未合并main；已登录Chrome自动化仍受限，真实管理员保存与真机软键盘不计PASS。上一正式部署dpl_3uXTPRgAjbBTxxhMJoufPhsTdwDm保留。


## 2026-10-10 — 后台全面修复候选完成

- 64项本地实施完成，隔离工作树 `.codex-worktrees/admin-panel-comprehensive-20261010` / 分支 `codex/admin-panel-comprehensive-20261010`，基准a32c8b9（运行源码832c53c）；主目录既有业务改动保留。
- 129后台测试、26商城/导入回归、18真实组件模拟交互、60页面/视口组合、全量lint/build与diff检查PASS；实际编译Next的9个匿名后台API均403，后台页跳登录。独立SQL/RLS和恢复流程静态GO。模拟环境和真实服务边界均已在报告说明。
- PartsPro-V4/yiuxrjqexlfjtxxrkqvi已核对，linked历史无remote-only分歧，dry-run仅20261010204858_admin_support_atomic_reply.sql（原子客服回复、会话动作、财务最小批次读取）。生产迁移、正式发布和真实业务写验收均未执行，当前状态local_ready_for_owner_gate。
- 逐项结果及回退说明：工作树 `docs/audits/2026-10-10-admin-panel-repair-verification.md`；证据 `outputs/admin-repair/2026-10-10/`。统计凭据/eBay真实政策、生产真实账号和物理手机另行验收；原有图片并发和库存跨请求幂等事项保持原范围。


## 2026-10-11 — 后台状态规范及授权上线进行中

- 老板已明确要求完成修复后上线，并参照小红书等资料设计组件状态。沿用64项修复候选工作树，不发布主目录未提交业务代码。
- 本次批准范围：仅20261010204858_admin_support_atomic_reply.sql应用到PartsPro-V4/yiuxrjqexlfjtxxrkqvi，再发布验证通过的精确候选到partspro.app/www.partspro.app。授权不包含真实订单、付款、库存、权限或客服消息等业务写入。
- 共享组件已实现信息/成功/警告/错误、提交中、紧凑空状态和错误汇总；后台限定样式覆盖焦点/禁用/只读/校验/选中/Portal层级/减少动画。资料与状态矩阵记入既有后台修复报告。
- 最新只读外部核对：Vercel parts-pro-v4 / prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo / team_AOJDnrjov0QDLqpvMyhwA1yc；正式域名仍指向dpl_BgiuoEqK7TPqFqSA66FC8KvG3qCL。Supabase健康，迁移无remote-only分歧，dry-run仍只列本次文件；尚未执行db push或生产promote。
- 新增状态fixture通过1440/390/360三档真实组件交互及reduced-motion测试，18业务交互/60布局组合和发布候选lint/build重新验证进行中。最终迁移、部署和只读验收结果完成后更新本节。


## 2026-10-11 — 后台全面修复与状态规范正式发布完成

- 64项修复、16面板提示/12写面板等待态/8列表空态及焦点、只读、禁用、校验、选中、弹层和减少动画规范已上线。资料采用小红书官方反馈原则、Dynatrace与GOV.UK规范，细节在后台修复报告；没有替换既有业务保护。
- 获得本次明确批准后，仅20261010204858_admin_support_atomic_reply.sql受控应用到PartsPro-V4/yiuxrjqexlfjtxxrkqvi。三个函数body/ACL/search_path核对PASS，应用后dry-run up to date，无生产业务数据写入或RLS重写。
- 首次a826642发布的真实管理员只读验收发现统计by=[]错误，直接API确认后修为production单组environment期间总值，并补官方Analytics 2.0.1公开页面采集。只采集双正式HTTPS域名首页/目录/商品pageview，剔除query/hash，保留回调阻断私有SPA事件。无新增迁移、生产env/开关、权限提升或服务购买。
- 最终源码e09af0e72578a17264223a1434a44939df76e99f已推送codex/admin-panel-comprehensive-20261010，未合并main，主目录既有业务改动未部署。production dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ READY，同SHA Vercel success，405上传SHA1全匹配、候选12HTTP及独立PROMOTE GO后切域名；两正式alias及正式12HTTP核对PASS。
- 最终144后台/统计＋6商城＋20导入共170测试、完整lint/build/diff PASS。19真实组件模拟交互、60布局组合和4状态fixture证据复用于未变UI。真实管理员12桌面/6手机重点面板只读检查通过，财务20批次选项和手机弹窗按钮可达；正式统计7/30日读取显示新增1次浏览/1匿名访客，首页实际SDK2.0.1与HTTP200脚本、fresh后台无SDK已核对，viewport已恢复。近15分钟error日志0条，仅短时观察。
- 报告：工作树docs/audits/2026-10-10-admin-panel-repair-verification.md；证据outputs/admin-repair/2026-10-11/。first-release保留首次部署/失败记录。历史漏采不能回填；访客是24小时匿名标识的UTC期间聚合。真实业务保存、记账、发送、库存、权限、eBay刊登/回流、退款、生产负载和真机软键盘仍未验收，不以只读/模拟证据冒充。
- 回退首选dpl_EgvvHNSc3EaCZ1yMgPuMczg3q4U4（首轮完整修复），此前dpl_BgiuoEqK7TPqFqSA66FC8KvG3qCL仍保留；新增函数可保留，不需删库或修复迁移历史。


## 2026-10-11 — 全站前台修复与组件状态发布收尾

- 前台59项逐项修复映射、后台64项整合；隔离候选 `codex/frontend-ux-states-release-20261010`，完整merge刚上线后台a826，保护主工作树未提交业务改动。完整结果见 `docs/audits/2026-10-11-full-frontend-repair-verification.md`，状态规范见 `docs/design/component-states.md`。
- 已批准且应用唯一checkout迁移20261010215007；PartsPro-V4/yiuxrjqexlfjtxxrkqvi linked up to date，private RLS/ACL、三RPC权限与原下单函数摘要核对通过。后台20261010204858已由前一任务应用。无真实交易或客户写验收。
- 最新后台集成独立104/104，客户回归60/60，真实PG17多连接3/3，lint/build通过。浏览器合成组件已验证手机目录、删除撤销、unknown订单回执及新购物车保留、账户详情、登录表单、客服草稿/身份清理、售后读取重试。实际账户/邮件/交易/真机范围明确在报告。
- 本次production候选与promote尚在收尾；当前回退目标dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ。下文最终发布记录将给出运行源码和deployment，不能以上方旧进行中记录推断当前生产。

发布基线补充：正式www.partspro.app已更新到e09af0e（统计采集修复），本候选再次完整merge，最新统计12/12通过，依赖变更后全量lint/build再次通过。默认Vercel别名与custom域名暂不同步，以custom域名dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ作为回退基线；两个旧预检部署不再作为正式商城的当前版本。账户脏草稿原生确认框自动化受到工具阻塞，未将取消放弃/确认放弃交互算PASS；浏览器关闭清理也受到同一阻塞。


## 2026-10-17 — 设计板高度还原发布候选 UI03

- 从74cc6e6建立独立候选，重做双层导航、配件主题首页、三种商品卡、目录草稿筛选、账户和认证/购买流程布局。按老板最新要求替换蓝底白P站点及PWA图标，后台/服务/API/DB/依赖/生产env保持既有发布基线。
- 已修品牌切换残留机型、平板搜索入口、售后已寄出更换件计数，补页签键盘交互和窄屏公司卡。实际组件本地夹具覆盖账户、非空购物车和checkout；生产不包含夹具。32相关合同、源码lint/build与独立静态审查通过。
- 当前仍为发布候选，正式域名只读核对仍在dpl_AeHQgnmVHqiPch8dUkwDvikvCcwg；平台候选及最终域名验收后追加最终记录。


## 2026-10-17 — 设计板高度还原 UI03 正式上线

- 最终运行 c2e55254016a12c76ee7246af53112648b4a109b 已推送 codex/storefront-visual-match-20261017；dpl_BGN6DBjWepiQRjU3svqkeFLx2DMV 经精确同构建验收及独立 PROMOTE_GO 后切到 www.partspro.app / partspro.app，apex307跳www。此记录替代上方本轮进行中/候选状态；回退保留 dpl_AeHQgnmVHqiPch8dUkwDvikvCcwg。
- 按27 PNG重做全前台结构与蓝底白P标志/PWA。32合同、lint/本地及远端build、1084源码一致/451保护/452上传hash、候选12和正式12HTTP、双语/多宽度浏览器及真实已登录员工自购账户只读布局通过。源码fp7acf854538c7a3e9655d709be47e3594f8c22c5f0acb853e3cb8401472ba5970。未改后台/API/DB/依赖/env，不部署本地夹具；主目录改动保留，未合并main。
- 已修筛选残留、平板搜索、售后终态计数和键盘/窄屏布局。旧submitted订单显示待付款但汇总只统计pending_payment的问题仍需统一，账户统计只基于已加载资料；详见 docs/audits/2026-10-17-storefront-reference-fidelity-release.md。无真实交易/资料/售后/消息写验收，物理键盘未测。
- 全套交付位于 outputs/storefront-reference-match/2026-10-17/partspro-ui-full-kit.zip；任务已转 docs/tasks/done/P1-2026-10-17-storefront-preview-fidelity.md。


## 2026-10-17 UI04：原稿组件与布局补齐（已上线）

- TASK-20261017-UI04：按27原稿补齐地球全名语言下拉和手机常驻入口、共享顶部/搜索/设备树、首页、购物车列、结算三组与摘要、公司地址工作区、资料页签、账户通知、真实图库及登录/专业申请。保留真实数据和校验，未改后台/API/DB/env/依赖，无migration前置。
- 运行 `f89a515d5da294e947a65fe1e132b06f2cb6835c` 已推送 `codex/storefront-fidelity-detail-20261017`；独立PROMOTE_GO后，`dpl_FU4dTyHQ8MxxtxPsMKTztGYqR64N` 同构建正式上线，两alias核对同SHA READY；apex307到www。回退保留BGN6/c2e5525。根工作树既有未提交改动保留，未合并main。
- lint/build/32相关合同、1087源码一致/450保护/452上传、候选与正式各12HTTP、语言实际IT/ZH切换与刷新保持、1536/768/390/320合成组件及真实1536/390只读布局通过。已登录账户公司地址工作区确认，无联系方式截图导出；15m运行error/fatal无组，仅短时观察。
- 自动审批拒绝资料保存校验点击，未执行或绕过；真实交易/资料/申请/通知写入未测。旧submitted待付款文案和计数口径差异仍待后续规范，分页统计边界已提醒。报告 `docs/audits/2026-10-17-storefront-component-fidelity.md`，任务已转done，全套 `outputs/storefront-fidelity-detail/2026-10-17/partspro-ui-full-kit-ui04.zip`。


## 2026-10-17 UI05：前台局部加载与后台刷新（已上线）

- TASK-20261017-UI05 已完成。运行提交 `a1073b8767c16ba48eab90aa2f0d976032ab53d4` 已推送 `codex/storefront-local-refresh-20261017`；独立 SOURCE_GO、STAGE_GO2、PROMOTE_GO 后，将 `dpl_B8YduhG5zUjCYirDGSuc6xX8fBtV` 同构建推广。www/apex 均核对 READY/同SHA，apex307到www；回退保留 `dpl_FU4dTyHQ8MxxtxPsMKTztGYqR64N` / f89a515。
- 取消按刷新版本隐藏/重建整页，增加公开安全骨架、共享刷新调度、120ms局部提示、15s终态和显式重试；保留同账户筛选、分页、草稿和弹层。身份/代客scope隔离与过期报价购买门禁保留；目录每批最多50、并发2且拒绝旧响应。目录/购物车原有空Suspense回退一并替换。
- 6+51相关合同/行为测试、lint（排除本地verification生成bundle）、本地和远端build通过；1097源码blob一致/450保护文件无改/459上传文件核对，源码fp `a39383d337c4b219f28a21d80f7f3229e89ac49edaac690fa56e47e43b89b68a`。候选/正式各12HTTP、真实Next导航及语言切换、正式1536/390布局通过，短时error/fatal均0。真实组件合成夹具验证慢网/断网/超时、焦点风暴、分页/滚动/数量和订单备注、弹层焦点及身份变化；不冒充真实业务写E2E。
- API、数据库、环境变量、后台、Logo和价格算法未变，无migration依赖。主目录现有未提交改动保留，运行源码在 `.company-tmp/storefront-local-refresh-20261017`，未合并main。详细报告 `docs/audits/2026-10-17-storefront-local-refresh-release.md`；任务 `docs/tasks/done/P1-2026-10-17-storefront-local-refresh.md`，预览证据 `outputs/storefront-local-refresh/2026-10-17/`。


## 2026-10-17 UI06：前台页首与筛选精简（已上线）

- TASK-20261017-UI06完成。运行提交 `e9e814dc27a8054ae223d19cb0953d8aabebc78a` 已推送 `codex/storefront-compact-header-20261017`；独立STAGE_GO2/PROMOTE_GO2后，同构建 `dpl_2ax6n9uKXsDtPkzwTQk1nZL16Wwf` 正式上线。www/apex均READY/同SHA，apex307→www；回退保留 `dpl_84Mo47vkuRDf41SYAjK4c3cUvTGp` / 5d329f1。
- 目录桌面保留左树、顶部44px排序/筛选；手机44px搜索+44px工具条，移除重复标题/路径/说明/数量/标签和空闲刷新占位。筛选草稿应用/取消/重置保留q/sort，数字badge及显式关闭回焦。账户、购物车/结算、商品详情、RMA、申请、登录、帮助和首页页首同步压缩，保留业务限制/报价/校验/规则。
- 源码冻结后识别并发生产REG01更新，旧31f候选未推广；无冲突合入已上线5d329f1，完整保留注册语言修复。相对最新正式基线453保护文件0改，1109blob一致；462运行文件上传hash全匹配，另1个生成next-env一致。指纹 `2b8e77cf6c38147cfffab3730c83fcb07b8e1dd75d71ff3513b9666b8a911578`。
- storefront13+相关41共54案例、lint、本地/远端build通过；目录双语四宽度、其他页48组及合并后账户8组几何检查无横溢，1536/1280首卡445→190px。筛选/清搜索/排序/分页24→48/商品返回恢复48/慢刷新失败重试/回焦通过。候选和正式各12只读HTTP；正式1536/390双语与短时error/fatal均通过（日志0条）。
- API、DB、env、后台、Logo和交易协议未变，无migration依赖。主目录未提交源码保留，未合并main；真实注册/资料/交易写入未执行，合成组件证据不冒充业务写E2E。报告 `docs/audits/2026-10-17-storefront-compact-header-release.md`，任务转done，截图/证据 `outputs/storefront-compact-header/2026-10-17/`。

## 2026-10-17 REG01：注册/个人中心语言反馈上线与闭环审计

- TASK-20261017-REG01 已发布。实际生产基线 a1073b8；独立候选提交 `5d329f192cfdb0ebbc31af2fcaa2e62cada42126` 已推送 `codex/registration-i18n-20261017`。SOURCE_GO/PROMOTE_GO 后，同一生产配置构建 `dpl_84Mo47vkuRDf41SYAjK4c3cUvTGp` 推广至 www.partspro.app / partspro.app；根域名307到www，回退保留 B8/a1073b8。
- 固定账户文案接入字典，资料/订单错误按code本地化，校验不再依赖浏览器语言，促销日期与关闭按钮跟随网站语言。保留正式新版UI、双组表单、未保存保护、保存关闭锁、请求竞态隔离。主目录其他未提交改动及UI06候选未混入。无API/auth动作/SQL/环境变量改动，无migration依赖或生产数据写入。
- 候选13测试、全量lint、本地/远端build通过；18项真实组件隔离浏览器、候选13和正式13项HTTP、正式6项匿名浏览器检查通过，截图已核对；457运行输入上传hash一致，无敏感文件；短时error/fatal查询无组。无真实邮箱注册/客户资料保存/交易写验收，未测物理iPhone键盘。
- 审计保留5项未修问题（4P2/1P3）：仅后台中文Cookie被新商城账户继承、setup重复弹窗、资料warning漏传、前后端字段限制不一致、返回账户栏目被拦截。不能把翻译发布描述为全部语言跳变或业务闭环已消除；建议优先单独修复语言继承与setup。报告 `docs/audits/2026-10-17-registration-closure-report.md`，证据 `outputs/registration-i18n/2026-10-17/release/`，任务转done。


## 2026-10-17 REG02：设备默认语言、英语与注册闭环修复（已上线）

- TASK-20261017-REG02 已发布。固定运行提交 `4096f92b62e6797d901a3940bf49e168e72027f1` 已推送 `codex/registration-closure-device-locale-20261017`，SOURCE_GO/PROMOTE_GO 后同构建 `dpl_BTLh3gDWL3P8fF9gPVLmVoSsJZR1` 推广至 www/apex；apex307到www。回退保留UI06 `dpl_2ax6n9uKXsDtPkzwTQk1nZL16Wwf`。
- 三语言覆盖商城/注册/个人中心/后台：本设备显式选择优先，否则设备首选en/zh/it，其他/缺失为英语；恢复设备语言可清除覆盖。不再读写账户语言偏好。REG01五个遗留问题已修复并验证，保留客户/商品/地址/备注原文。
- 24测试、53相关测试、35实际组件隔离浏览器、候选/正式各30HTTP、正式19浏览器通过；lint和本地/远端build通过，469运行输入上传hash一致。真实手动切换/刷新/恢复设备语言已验证，仅2次语言Cookie action，生产客户/交易写0，无migration/env变更，短时error/fatal无组。
- 合入已上线UI06 e9e814d/8002518，保留紧凑页头和筛选草稿，主目录其它改动未混入。无真实邮箱注册或物理iPhone系统键盘验收。报告 `docs/audits/2026-10-17-registration-device-locale-release.md`，证据 `outputs/registration-device-locale/2026-10-17/release/`，任务转done。


## 2026-10-17 UI07：移动端高密度预览还原（已上线）

- TASK-20261017-UI07已完成。运行提交 `c68206ccd977ba6c8770bc6753bd37f2fbc86a38` 已推送隔离分支 `codex/storefront-mobile-density-20261017`；独立SOURCE_GO/PROMOTE_GO后，同一构建 `dpl_B8UXo2AiVFfNyrqvDThCSAwNLJGw` 已推广至www/apex，apex307到www。回退保留BTL/4096f92。
- 落实7张批准预览，仅调整<768px前台，所有商品区横向紧凑卡，正式预售卡191px、同卡降低45.8%；购物/结算/账户/详情/售后/申请/登录/帮助及局部状态统一压缩。主目录其它未提交运行源码不纳入发布，无API/DB/env/后台/Logo/交易协议改动或migration依赖。
- 24+60测试、lint、本地/远端build、210手机几何及30桌面对照通过；473上传源hash一致。候选和正式各12+30 HTTP通过，实际三语及手机/桌面、账户/购物/结算只读布局已核对，短时error/fatal为空，独立RELEASE_VERIFIED。真实业务写及物理iPhone键盘未做E2E。报告 `docs/audits/2026-10-17-storefront-mobile-density-release.md`，证据 `outputs/storefront-mobile-density/2026-10-17/`，任务转done。

## 2026-10-17 UI08：手机侧边菜单四类直达（已上线）

- 已按老板要求移除菜单内首页/帮助/目录及全部目录层，直接展示手机、平板、电脑、电子产品；保留搜索、语言切换、品牌机型展开和当前选择。桌面/筛选全部目录入口保留。仅4前台运行文件，无Logo/API/DB/env/后台/交易变化。
- 隔离分支 `codex/storefront-mobile-menu-20261017`，运行提交 `23db1b2783356c18ac658970af7064ccf81f0cdb`，独立STAGE_GO/PROMOTE_GO后同构建 `dpl_CzDN5mBvDaEd343VGLGk1iqoF3sN` 已推广www/apex；apex307到www，最终RELEASE_VERIFIED。回退保留B8UX/c682。
- 24storefront+13相关通过、另7目录契约通过本地别名loader（既有裸Node runner问题如实记录）；lint/build、三语390/320、导航/搜索/重开/焦点及桌面/筛选回归通过，候选/正式各12+30 HTTP通过，稳定正式中文截图及短时日志已复核。报告 `docs/audits/2026-10-17-storefront-mobile-menu-release.md`，证据 `outputs/storefront-mobile-menu/2026-10-17/`。
