# PartsPro 代理协作规则

本文件是 PartsPro 仓库内所有 Codex、Claude、worker、explorer 和其他代理的共同工作声明。`CLAUDE.md` 只引用 `@AGENTS.md`，所以这里是默认真相源。

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目身份

- PartsPro 是面向意大利手机维修店和专业客户的配件商城与后台运营系统。
- 技术栈：Next.js 16 App Router、React 19、TypeScript、TailwindCSS v4、shadcn/Radix、Supabase、Vercel。
- 关键业务域：商品目录、客户等级与价格、购物车、checkout、订单、库存、RMA、后台账号和权限、供应商到货导入。
- linked Supabase 本机状态默认指向 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。该目标按生产敏感项目处理，不能因为已经 linked 就无条件写库。

## AI Company OS 接入层

- 完整 AI Company OS 治理包已接入 `.ai-company/`，作为任务治理、角色分工、风险控制、质量门禁、发布运营、决策记录和复盘模板的参考库。
- PartsPro 专属执行层位于 `docs/project-charter.md`、`docs/roadmap.md`、`docs/risks/risk-register.md`、`docs/decisions/decision-log.md`、`docs/adr/`、`docs/runbooks/`、`docs/tasks/` 和 `docs/agents/`。
- 规则优先级：老板当前明确指令 > 本文件 `AGENTS.md` 和 PartsPro 专用文档 > 已批准的项目章程/决策/runbook/任务卡 > `.ai-company/` 通用规则。
- 非微小任务应参考 `.ai-company/TASK_FLOW.md` 和 `docs/tasks/TEMPLATE.md`，记录 Task ID、风险等级、自治等级、RACI、批准要求、验证证据和残余风险。
- 低风险任务可以简化流程；R2 以上任务、跨部门任务、价格/订单/库存/权限/数据库/发布任务必须保留完整任务卡和工程守门。
- 不要把 `.ai-company/MASTER_PROMPT.md` 或通用 `AGENTS.md` 直接提升为高于本文件的规则；如需调整项目制度，必须写入 `docs/decisions/decision-log.md` 或 `docs/adr/`。

## 工作原则

1. 先读现状，再动手。搜索优先使用 `rg` / `rg --files`。
2. 不要覆盖用户或其他代理的未提交改动。修改前看 `git status --short`，只触碰本任务范围内文件。
3. 写 Next.js 代码前必须先读 `node_modules/next/dist/docs/` 中对应主题，例如 App Router、Route Handlers、Server Actions、缓存、metadata 或 config。
4. Supabase 任务必须遵守当前 CLI/MCP 文档，不凭记忆猜命令。需要新 migration 时必须用 `supabase migration new <name>` 创建。
5. 价格、订单、库存、权限和客户资料属于强业务契约。SQL、RPC、API DTO、前端类型和 UI 文案必须一起核对。
6. 不在浏览器端暴露 `SUPABASE_SERVICE_ROLE_KEY`、secret key 或任何非 `NEXT_PUBLIC_` 的敏感变量。
7. Vercel 发布和 Supabase migration 应用是两个独立动作，不能自动绑在一起。

## 老板派单入口

老板可以把任务写成一句业务目标，但代理接手后必须先把它整理成可执行任务卡。长期任务和跨部门任务统一放入 `docs/tasks/`：

- `docs/tasks/urgent/`：P0/P1，生产、付款、订单、库存、权限、数据安全等必须优先处理的问题。
- `docs/tasks/now/`：当前正在推进的任务。
- `docs/tasks/backlog/`：已确认但暂不执行的计划。
- `docs/tasks/done/`：已完成并可追溯验收结果的任务。

任务文件命名使用 `P1-YYYY-MM-DD-short-slug.md`，不要使用 `4.md`、`4.mad` 这类无语义文件名。每个任务至少写清楚：目标、业务影响、主责部门、协作部门、涉及页面/API/表、风险等级、自治等级、批准要求、验收标准、禁止事项和验证命令。

## AI 部门路由

当任务需要 AI 员工分工时，先指定一个主责部门，再按风险加上工程守门代理。业务部门 profile 位于 `docs/agents/`：

- 总调度/项目经理：拆任务、定优先级、分派部门、维护 `docs/tasks/` 状态。
- 商品目录部：商品建档、SKU、分类、图片、上下架和商品资料质量。
- 价格与客户部：客户等级、零售/批发、客户资料、价格展示和客户权限。
- 订单运营部：购物车、checkout、订单、付款、钱包退款和客户订单体验。
- 仓库库存部：库存、锁货、出入库、库存动作、缺货和 RMA 回补。
- 采购到货部：供应商、批次、发票/装箱单、Mobilax/UTOPYA 导入和补图清单。
- 电商渠道部：eBay 连接、刊登、价格库存同步、队列和订单回流。
- 平台发布部：Next.js、Supabase、Vercel、环境变量、构建和上线 smoke test。
- 文档审计部：README、AGENTS、runbook、历史计划和交接记录。

业务部门负责目标、业务规则和验收；工程守门代理负责技术边界、安全门和验证。

## Skill 使用规则

- 涉及 PartsPro 全链路审计、业务契约、价格、订单、库存、客户、RMA 或前后端字段一致性时，优先使用可用的 `partspro-fullstack-audit` skill 做只读扫描或检查清单。
- 涉及 Supabase、RLS、migration、RPC、Storage、Auth 或数据库权限时，必须遵守 Supabase 相关 skill/文档和本文件的 migration 安全门。
- 涉及 Next.js 16 App Router、Route Handlers、Server Actions、metadata、缓存或 config 时，必须先读 `node_modules/next/dist/docs/` 中对应主题。
- 涉及 Vercel 部署、日志、env 或域名时，使用 Vercel 相关能力前必须确认是否依赖已应用 migration。
- 项目文档只声明 skill 使用规则，不把个人本机 `.codex/skills` 当成仓库依赖；如果某个 skill 不可用，代理必须说明降级方案。

## 子代理路由

当任务复杂、可并行或用户明确要求子代理时，按下面角色拆分。独立 profile 位于 `docs/agents/`。

- Next.js 16 App Router 代理：负责 App Router、Route Handlers、Server/Client 边界、Next config、缓存和 Vercel 运行时兼容。
- Supabase Migration 守门代理：负责 migration 生成、风险扫描、dry-run、linked 项目确认、应用后验证。
- Supabase RLS/权限代理：负责 RLS、policy、grant/revoke、security definer、search_path、Storage policy 和 exposed schema 安全。
- PartsPro 业务契约代理：负责商品、价格、客户、订单、库存、RMA、后台权限的端到端一致性。
- 前端体验代理：负责 storefront/admin UI、i18n、shadcn/Radix/Tailwind v4、响应式和可访问性。
- 供应商到货导入代理：遵守 `docs/PartsPro 到货导入声明规则.md`，先只读预检，再确认导入声明，再写库。
- Vercel 发布代理：负责 build、env、deployment readiness、部署验证；不负责自动应用 migration。
- 文档账本代理：维护 README、AGENTS、schema 状态说明、runbook 和历史声明，避免过期 pending 信息误导。

## 跨部门协作规则

- 一个任务只能有一个主责部门，但可以有多个协作部门和守门代理。
- 价格、订单、库存、权限、客户资料和支付相关任务，必须由 PartsPro 业务契约代理参与验收。
- 新增或修改 `supabase/migrations/*.sql` 时，必须由 Supabase Migration 守门代理收尾；涉及 policy/grant/RLS 时还必须加入 Supabase RLS/权限代理。
- 修改 `src/app/**`、Route Handler、Server Action、缓存或 Next config 时，必须加入 Next.js 16 App Router 代理。
- 修改 storefront/admin UI 或 i18n 文案时，必须加入前端体验代理。
- 发布、回滚、线上 smoke test 或 Vercel env 变更必须加入 Vercel 发布代理，且不得自动代替数据库 migration。
- 文档与当前代码、migration 或线上状态冲突时，由文档账本代理修正，不保留误导性 pending 描述。

## Supabase Migration 安全门

任务结束时，如果新增或修改了 `supabase/migrations/*.sql`，必须进入 migration 安全门。默认命令前缀：

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
```

自动应用 linked migration 只允许在全部条件成立时执行：

- 用户没有要求只生成、只读或不要应用。
- linked project ref/name 明确匹配 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。
- `supabase migration list --linked` 没有 remote-only divergence。
- `supabase db push --linked --dry-run` 只列出本次任务产生的 migration，不夹带旧 pending migration。
- SQL 风险扫描没有破坏性变更或高风险权限变更。
- `npm run lint` 和 `npm run build` 通过。

任一情况必须停止并询问用户：

- dry-run 会应用不属于本次任务的旧 migration。
- 出现 `drop table`、`truncate`、大范围 `delete/update`、危险 `grant/revoke`、RLS/policy 重写、auth/storage 权限重写或生产数据回填。
- 需要 `migration repair`、`--include-all`、`--include-seed`、`db pull`、`db reset --linked` 或生产 env 修改。
- linked 目标不明、CLI/MCP 认证异常、build/lint 失败或 build 卡住。

详细 SOP 见 `docs/PartsPro 代理协作与迁移护栏.md`。

## 验证要求

- 文档或小改动：至少运行 `git diff --check`，必要时运行 `npm run lint`。
- Next/API/组件改动：运行 `npm run lint`，尽量运行 `npm run build`；若 build 卡住或失败，清理进程并报告。
- Supabase schema 改动：应用前 dry-run，应用后重新 `migration list --linked` 并跑针对性 SQL smoke query。
- 供应商导入：先只读 preflight，确认声明，写库后核对数量、金额、库存、批次、审计事件和图片状态。

## 禁止事项

- 不要运行 `git reset --hard`、`git checkout --` 或删除用户改动，除非用户明确要求。
- 不要静默执行生产数据库破坏性 SQL。
- 不要自动推 Vercel deploy 来弥补 migration 或代码未验证。
- 不要用 README、`supabase/schema.sql` 或本机 `.temp` 单独判断远端 migration 真相；真实状态必须以 linked 查询为准。
- 不要把 create-next-app 模板说明当成项目运维规则。
