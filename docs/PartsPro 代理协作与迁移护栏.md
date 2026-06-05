# PartsPro 代理协作与迁移护栏

最后更新：2026-06-05

本文档定义 PartsPro 代理协作方式，以及任务结束后 Supabase migration 的自动应用边界。目标是让代理主动完成低风险迁移，同时避免把旧 pending、破坏性 SQL 或错误 linked 项目推到生产库。

## 代理协作模型

- 根规则写在 `AGENTS.md`，`CLAUDE.md` 通过 `@AGENTS.md` 复用。
- 子代理 profile 存放在 `docs/agents/`，用于派发 explorer、worker 或人工复制提示词。
- 子代理 profile 不是运行时安装文件，不代表项目自动拥有常驻 agent。只有当前工具或用户明确允许时才实际生成子代理。
- 多代理并行时，必须划清写入范围，不能互相覆盖文件。所有代理都必须尊重当前工作区的用户改动。

## Migration 自动应用定义

“自动应用”不是无条件静默 `supabase db push`。它的含义是：任务完成后，代理自动检查是否存在本次任务新增或修改的 migration；如果全部安全门通过，则可以应用到 linked 项目；否则必须中止并向用户说明原因。

linked 项目默认按生产敏感目标处理：

- project ref: `yiuxrjqexlfjtxxrkqvi`
- project name: `PartsPro-V4`
- Vercel project: `parts-pro-v4`

## 应用前安全门

只有全部条件满足，才允许执行 `supabase db push --linked`：

1. 本次任务确实新增或修改了 `supabase/migrations/*.sql`。
2. 代码或功能依赖该 schema 变更才能正常运行。
3. 用户没有说“只生成 migration”“不要应用”“只读”。
4. linked ref/name 与文档白名单一致。
5. `supabase migration list --linked` 没有 remote-only divergence。
6. `supabase db push --linked --dry-run` 只列出本次任务产生的 migration。
7. SQL 风险扫描未发现高风险或破坏性变更。
8. `npm run lint` 通过。
9. `npm run build` 通过；如果构建卡住，必须清理进程并中止自动应用。

统一命令前缀：

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
```

应用前建议命令：

```bash
git status --short
git diff --name-only
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase --version
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
rg -n "(?i)(drop table|truncate|delete from|alter table .* drop|security definer|grant |revoke |create policy|drop policy|storage\\.|auth\\.)" supabase/migrations
npm run lint
npm run build
```

实际应用命令：

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked
```

## 必须中止并询问的情况

- dry-run 显示将应用不属于本次任务的旧 pending migration。
- 出现 `drop table`、`truncate`、大范围 `delete from`、大范围 `update` 或 `alter table ... drop`。
- 涉及 RLS/policy、`grant`、`revoke`、`security definer`、`search_path`、auth、storage 或核心权限重写。
- 涉及价格、订单、库存、客户资料、checkout 或支付相关生产数据回填。
- 需要 `--include-all`、`--include-seed`、`migration repair`、`db pull`、`db reset --linked` 或生产环境变量修改。
- linked 项目无法确认，CLI/MCP 未认证，或者 Supabase 命令失败后无法通过 2-3 次不同方法定位原因。
- `npm run lint` / `npm run build` 失败，或 build 长时间无输出且无法正常结束。

## 应用后验证

应用成功后必须执行：

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
```

应用后 dry-run 应显示无待应用 migration。还必须跑针对性 SQL smoke query，例如：

- 新表：检查表、RLS、policy、grant 和 Data API 可见性。
- 新 RPC：检查函数签名、`search_path`、权限和示例调用。
- 视图：检查 `security_invoker`、字段和 RLS 访问路径。
- 价格/订单/库存：抽样验证真实 SKU、客户、订单或库存行。

## 与 Vercel 发布的关系

- migration 应用不自动触发 Vercel deploy。
- Vercel 发布代理只负责构建、环境变量、部署和线上 smoke test。
- 如果代码依赖已应用 migration，先完成数据库验证，再进入 Vercel 发布流程。

## 文档维护

- README 不记录单个 migration 的永久 pending 断言；真实状态以 `supabase migration list --linked` 为准。
- `supabase/schema.sql` 只能作为快照或参考，不可单独视为远端真相源。
- 发现 README、schema 注释或历史文档过期时，由文档账本代理更新说明或标记历史状态。
