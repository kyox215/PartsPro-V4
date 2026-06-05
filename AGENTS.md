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

## 工作原则

1. 先读现状，再动手。搜索优先使用 `rg` / `rg --files`。
2. 不要覆盖用户或其他代理的未提交改动。修改前看 `git status --short`，只触碰本任务范围内文件。
3. 写 Next.js 代码前必须先读 `node_modules/next/dist/docs/` 中对应主题，例如 App Router、Route Handlers、Server Actions、缓存、metadata 或 config。
4. Supabase 任务必须遵守当前 CLI/MCP 文档，不凭记忆猜命令。需要新 migration 时必须用 `supabase migration new <name>` 创建。
5. 价格、订单、库存、权限和客户资料属于强业务契约。SQL、RPC、API DTO、前端类型和 UI 文案必须一起核对。
6. 不在浏览器端暴露 `SUPABASE_SERVICE_ROLE_KEY`、secret key 或任何非 `NEXT_PUBLIC_` 的敏感变量。
7. Vercel 发布和 Supabase migration 应用是两个独立动作，不能自动绑在一起。

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
