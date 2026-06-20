# PartsPro Project Charter

Status: active
Version: 1.0
Owner: Hexiang Huang / Chinatech
CEO Agent: 总调度/项目经理
Last reviewed: 2026-06-19

## 1. 项目使命

PartsPro 是面向意大利手机维修店和专业客户的配件商城与后台运营系统。项目目标是让 Chinatech 能稳定管理商品目录、客户等级价格、购物车、checkout、订单、库存、RMA、供应商到货导入和未来电商渠道同步。

## 2. 业务目标

- 为意大利 B2B 客户提供可信的手机配件查询、价格展示、下单和售后体验。
- 让后台运营能准确维护商品、库存、客户、订单、RMA 和供应商到货。
- 降低人工录入、库存错误、价格错误和订单异常带来的经营风险。
- 为 eBay 等电商渠道同步和未来自动化运营保留可审计基础。

## 3. 成功指标

- 价格、客户等级、库存和订单金额由服务端与数据库规则共同保护。
- 关键客户路径能通过浏览器或 API smoke test 验证。
- Supabase migration 每次都有 dry-run、风险扫描和应用后验证记录。
- 发布任务有版本、范围、回滚、smoke test 和观察结果。
- 文档、任务卡和实际代码保持一致，不保留误导性 pending 描述。

## 4. 目标用户与利益相关者

- 店铺老板：关注收入、效率、风险、可控成本和实际可用性。
- B2B 客户：手机维修店、专业买家和本地企业客户。
- 店铺运营人员：处理商品、库存、订单、客户、RMA 和供应商到货。
- 工程代理：Codex、Claude、worker、explorer 和工程守门代理。
- 外部平台：Supabase、Vercel、eBay、供应商系统和文件来源。

## 5. 核心范围

- Storefront：`/`、`/catalogo`、`/prodotto/[sku]`、`/carrello`、`/checkout`、`/account`、`/rma`。
- Admin：商品、库存、订单、客户、RMA、供应商到货和运营仪表盘。
- API：商品目录、购物车、订单、RMA、B2B 申请、客户上下文和后续集成接口。
- Data：Supabase schema、RPC、RLS、storage、migration、审计和数据质量检查。
- Operations：任务看板、风险登记、决策日志、发布清单、runbook 和复盘。

## 6. 明确非范围

- 不把 AI 代理变成无需老板批准的生产数据库管理员。
- 不自动执行 Vercel 生产发布或 Supabase linked migration。
- 不在本项目文档中保存生产 secret、服务角色 key 或个人敏感凭据。
- 不用静态假数据、虚假按钮或未连接后端的界面冒充完成。
- 不替代会计、税务、法律或隐私专业意见。

## 7. 技术与业务约束

- 技术栈：Next.js 16 App Router、React 19、TypeScript、TailwindCSS v4、shadcn/Radix、Supabase、Vercel。
- Next.js 16 有 breaking changes；涉及 App Router、Route Handler、Server Action、缓存、metadata 或 config 前必须读本地官方 docs。
- Supabase linked 项目默认指向 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`，按生产敏感资源处理。
- 价格、订单、库存、权限、客户资料和支付相关改动必须经 PartsPro 业务契约代理验收。
- Vercel 发布不能自动代替数据库 migration，数据库 migration 也不能自动触发发布。

## 8. 数据与合规边界

- 客户资料、订单、发票字段、联系方式、RMA 和账号权限属于敏感业务数据。
- 日志、测试数据、截图和文档不得泄露 secret 或不必要个人数据。
- 所有浏览器端代码只能使用 `NEXT_PUBLIC_` 允许暴露的配置。
- 供应商导入必须先只读预检，再由用户确认声明，写库后核对数量、金额、库存、批次和审计事件。

## 9. 自治等级与批准人

默认自治等级：L2 受控执行。

| 动作 | 默认允许 | 批准人/守门 |
|---|---|---|
| 文档、任务卡、只读审计 | L2 可执行 | 文档账本代理按需复核 |
| 低风险 UI/文案修正 | L2 可执行 | 前端体验代理按需复核 |
| Next.js Route/API/Server Action | L2 可执行 | Next.js 16 App Router 代理 |
| 价格、订单、库存、客户、权限 | L2 可执行但必须验收 | PartsPro 业务契约代理 |
| Supabase migration 生成 | L2 可执行 | Supabase Migration 守门代理 |
| Supabase linked migration 应用 | 需批准/安全门 | 用户与 Supabase 守门代理 |
| Vercel 生产发布 | 需批准/发布门 | 用户与 Vercel 发布代理 |
| 破坏性 SQL、权限例外、生产 env 修改 | 默认禁止 | 用户明确批准 |

## 10. 风险容忍度

- 低容忍：价格错误、订单金额错误、库存错扣、权限越权、客户资料泄露、生产数据库破坏性变更。
- 中容忍：非核心 UI 体验、文档结构、后台效率优化、低风险自动化。
- 可试验：只读审计、任务模板、决策日志、低风险运营流程自动化。

## 11. 关键系统与供应商

- Supabase：数据库、Auth、Storage、RLS、RPC 和 migration。
- Vercel：部署、环境变量、域名、日志和发布观察。
- Git/GitHub：版本控制、PR、CI 和审查。
- eBay：未来渠道刊登、价格库存同步和订单回流。
- 供应商：Mobilax、UTOPYA、发票、装箱单和图片来源。

## 12. 决策原则

- 先保护交易和数据正确性，再优化速度和体验。
- 能用现有项目模式解决时，不引入新框架或大抽象。
- 重大架构、权限、数据和发布决策必须写入 `docs/decisions/decision-log.md` 或 `docs/adr/`。
- 所有“完成”必须有验证证据，不能只靠描述。

## 13. 里程碑

| 阶段 | 目标 | 退出条件 |
|---|---|---|
| M1 治理接入 | AI Company OS 全量入库并接入 PartsPro 规则 | `.ai-company/`、章程、风险、决策、runbook 和任务模板就绪 |
| M2 核心交易稳定 | 商品、价格、购物车、checkout、订单和库存契约收敛 | lint/build/API smoke 与业务契约检查通过 |
| M3 供应商到货自动化 | 到货导入、补图、库存动作和审计闭环 | 预检、声明、写库后核对流程稳定 |
| M4 渠道同步 | eBay 刊登、价格库存同步和订单回流 | 队列、幂等、失败恢复和人工审核就绪 |
| M5 发布运营成熟 | 发布、回滚、观察和事故响应制度稳定 | runbook 经至少一次真实任务验证 |

## 14. 重新评估条件

- Supabase linked 状态、线上 schema 或发布配置与文档冲突。
- 价格、订单、库存、权限或客户资料出现生产级缺陷。
- 任务制度开始明显拖慢低风险交付。
- 代理权限、工具能力或项目技术栈发生重大变化。
